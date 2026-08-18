const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCSVInventory, getCSVProducts } = require('../data/csvDataLoader');

// In-memory fallback stock cache for active session mutations if DB is offline
let memoryInventoryStore = null;
let memoryStockMovements = [];

function getMemoryInventory() {
  if (!memoryInventoryStore) {
    memoryInventoryStore = getCSVInventory().map(item => {
      const physical = typeof item.inventoryLevel === 'number' ? item.inventoryLevel : (item.stockQuantity || 100);
      const reserved = typeof item.reservedQuantity === 'number' ? item.reservedQuantity : 0;
      const damaged = typeof item.damagedQuantity === 'number' ? item.damagedQuantity : 0;
      const available = Math.max(0, physical - reserved - damaged);

      let itemStatus = item.status;
      if (!itemStatus || itemStatus === 'NORMAL' || itemStatus === 'LOW') {
        if (physical <= 0) itemStatus = 'OUT_OF_STOCK';
        else if (available < (item.minThreshold || 30)) itemStatus = 'LOW';
        else if (physical >= (item.maxThreshold || 400)) itemStatus = 'OVERSTOCK';
        else itemStatus = 'NORMAL';
      }

      return {
        ...item,
        inventoryLevel: physical,
        stockQuantity: physical,
        reservedQuantity: reserved,
        damagedQuantity: damaged,
        availableQuantity: available,
        status: itemStatus
      };
    });
  }
  return memoryInventoryStore;
}

// GET /api/inventory (Supports multi-warehouse stock)
exports.getInventory = async (req, res) => {
  try {
    const { warehouseId, category, search } = req.query;
    let inventory = [];
    try {
      inventory = await prisma.inventoryRecord.findMany({
        include: { product: true, store: true },
        orderBy: { updatedAt: 'desc' }
      });
    } catch (e) {
      inventory = [];
    }

    if (!inventory || inventory.length === 0) {
      inventory = getMemoryInventory();
    }

    // Apply query filters if provided
    let filtered = [...inventory];
    if (warehouseId && warehouseId !== 'ALL') {
      filtered = filtered.filter(item => 
        item.storeId === warehouseId || item.warehouseName === warehouseId || item.store?.name === warehouseId
      );
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(item => 
        (item.productName || item.product?.name || '').toLowerCase().includes(q) ||
        (item.sku || item.product?.productId || '').toLowerCase().includes(q) ||
        (item.barcode || item.product?.barcode || '').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/inventory/barcode/:barcode - Inventory Lookup by Product Barcode
exports.getInventoryByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const cleanCode = String(barcode || '').trim().toLowerCase();

    if (!cleanCode) return res.status(400).json({ success: false, message: 'Barcode is required' });

    const cache = getMemoryInventory();
    const matches = cache.filter(item => 
      String(item.barcode || '').toLowerCase() === cleanCode ||
      String(item.sku || item.productId || '').toLowerCase() === cleanCode
    );

    if (matches.length === 0) {
      return res.status(404).json({ success: false, message: `No inventory records found for barcode: ${barcode}` });
    }

    return res.json({
      success: true,
      barcode,
      data: matches,
      totalPhysicalStock: matches.reduce((acc, curr) => acc + (curr.inventoryLevel || curr.stockQuantity || 0), 0)
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/inventory/adjust (Stock Adjustment Operation)
exports.adjustStock = async (req, res) => {
  try {
    const { productId, warehouseId, warehouseName, deltaQuantity, adjustmentQuantity, adjustmentType, reason } = req.body;

    const rawDelta = deltaQuantity !== undefined ? deltaQuantity : adjustmentQuantity;

    if (!productId || rawDelta === undefined) {
      return res.status(400).json({ success: false, message: 'productId and quantity/deltaQuantity are required' });
    }

    const change = parseInt(rawDelta, 10);
    if (!Number.isFinite(change)) {
      return res.status(400).json({ success: false, message: 'Invalid numeric quantity specified' });
    }

    const type = adjustmentType || (change >= 0 ? 'RECEIVED' : 'ADJUSTMENT');

    // Fetch current inventory item to validate resulting stock balance
    const cache = getMemoryInventory();
    const targetItem = cache.find(i => i.productId === productId || i.id === productId || i.sku === productId) || cache[0];

    const currentLevel = targetItem ? (targetItem.inventoryLevel || targetItem.stockQuantity || 0) : 100;
    const currentAvail = targetItem ? (targetItem.availableQuantity !== undefined ? targetItem.availableQuantity : currentLevel) : currentLevel;

    // Reject adjustments that would cause negative stock
    if (type === 'DECREASE' || change < 0) {
      const decreaseAmt = Math.abs(change);
      if (currentAvail < decreaseAmt || (currentLevel - decreaseAmt) < 0) {
        return res.status(400).json({
          success: false,
          message: `Stock adjustment rejected: Available stock cannot become negative. Current available stock: ${currentAvail}, attempted reduction: ${decreaseAmt}.`,
          currentStock: currentAvail,
          requestedAdjustment: change
        });
      }
    }

    let updatedRecord = null;
    let newMovement = null;

    try {
      // Database Transaction execution
      const targetInv = await prisma.inventoryRecord.findFirst({
        where: {
          OR: [
            { productId },
            { id: productId }
          ],
          ...(warehouseId ? { storeId: warehouseId } : {})
        }
      });

      if (targetInv) {
        const newLevel = Math.max(0, targetInv.inventoryLevel + change);
        const newReserved = targetInv.reservedQuantity || 0;
        const newDamaged = type === 'DAMAGED' ? Math.max(0, (targetInv.damagedQuantity || 0) + Math.abs(change)) : (targetInv.damagedQuantity || 0);
        const newAvailable = Math.max(0, newLevel - newReserved - newDamaged);
        let newStatus = 'NORMAL';
        if (newLevel === 0) newStatus = 'OUT_OF_STOCK';
        else if (newAvailable < 20) newStatus = 'LOW';

        const [updated, movement] = await prisma.$transaction([
          prisma.inventoryRecord.update({
            where: { id: targetInv.id },
            data: {
              inventoryLevel: newLevel,
              damagedQuantity: newDamaged,
              availableQuantity: newAvailable,
              status: newStatus
            }
          }),
          prisma.stockMovement.create({
            data: {
              movementId: `MOV-${Date.now()}`,
              productId: targetInv.productId,
              storeId: targetInv.storeId,
              movementType: type,
              quantity: Math.abs(change),
              reason: reason || `Stock Adjustment (${type})`,
              userId: req.user?.id || 'sys-user'
            }
          })
        ]);

        updatedRecord = updated;
        newMovement = movement;
      }
    } catch (e) {}

    // Memory cache fallback update
    if (!updatedRecord) {
      const cache = getMemoryInventory();
      const index = cache.findIndex(i => i.productId === productId || i.id === productId);
      if (index >= 0) {
        const current = cache[index];
        const newLevel = Math.max(0, (current.inventoryLevel || current.stockQuantity || 100) + change);
        const newReserved = current.reservedQuantity || 0;
        const newDamaged = type === 'DAMAGED' ? Math.max(0, (current.damagedQuantity || 0) + Math.abs(change)) : (current.damagedQuantity || 0);
        const newAvailable = Math.max(0, newLevel - newReserved - newDamaged);
        let newStatus = 'NORMAL';
        if (newLevel === 0) newStatus = 'OUT_OF_STOCK';
        else if (newAvailable < 20) newStatus = 'LOW';

        cache[index] = {
          ...current,
          inventoryLevel: newLevel,
          stockQuantity: newLevel,
          damagedQuantity: newDamaged,
          availableQuantity: newAvailable,
          status: newStatus
        };
        updatedRecord = cache[index];

        newMovement = {
          id: `mov-${Date.now()}`,
          movementId: `MOV-${Date.now()}`,
          productName: current.productName,
          sku: current.sku,
          warehouseName: warehouseName || current.warehouseName || 'Warehouse A (Chicago Hub)',
          movementType: type,
          quantity: Math.abs(change),
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          reason: reason || `Manual Adjustment (${type})`
        };
        memoryStockMovements.unshift(newMovement);
      }
    }

    return res.json({
      success: true,
      message: `Stock updated successfully (${type}: ${change > 0 ? '+' : ''}${change})`,
      data: updatedRecord,
      movement: newMovement
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/inventory/reconcile (Physical Inventory Reconciliation)
exports.reconcileInventory = async (req, res) => {
  try {
    const { productId, warehouseName, physicalCount, reason } = req.body;

    if (!productId || physicalCount === undefined) {
      return res.status(400).json({ success: false, message: 'productId and physicalCount are required for reconciliation' });
    }

    const physical = parseInt(physicalCount, 10);
    if (isNaN(physical) || physical < 0) {
      return res.status(400).json({ success: false, message: 'Physical count must be a non-negative number' });
    }

    const cache = getMemoryInventory();
    const targetItem = cache.find(i => i.productId === productId || i.id === productId);

    if (!targetItem) {
      return res.status(404).json({ success: false, message: 'Product inventory record not found' });
    }

    const currentSystemStock = targetItem.inventoryLevel !== undefined ? targetItem.inventoryLevel : (targetItem.stockQuantity || 100);
    const variance = physical - currentSystemStock;

    // Apply adjustment via adjustStock logic
    const adjustRes = await exports.adjustStock({
      body: {
        productId,
        warehouseName: warehouseName || targetItem.warehouseName || 'Warehouse A (Chicago Hub)',
        deltaQuantity: variance,
        adjustmentType: 'ADJUSTMENT',
        reason: reason || `Physical Count Reconciliation (System: ${currentSystemStock} vs Physical: ${physical})`
      },
      user: req.user
    }, {
      json: (data) => data,
      status: () => ({ json: (data) => data })
    });

    return res.json({
      success: true,
      message: `Inventory reconciled successfully! Physical count: ${physical} (Variance: ${variance > 0 ? '+' : ''}${variance})`,
      previousStock: currentSystemStock,
      physicalCount: physical,
      variance,
      reason: reason || 'Physical Stock Count Reconciliation Audit',
      user: req.user?.email || 'Operations Manager',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/inventory/low-stock
exports.getLowStock = async (req, res) => {
  try {
    const cache = getMemoryInventory();
    const lowStock = cache.filter(p => p.status === 'LOW' || (p.availableQuantity !== undefined ? p.availableQuantity <= 30 : p.stockQuantity <= 30));
    res.json({ success: true, count: lowStock.length, data: lowStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/inventory/out-of-stock
exports.getOutOfStock = async (req, res) => {
  try {
    const cache = getMemoryInventory();
    const outOfStock = cache.filter(p => p.status === 'OUT_OF_STOCK' || p.inventoryLevel === 0 || p.stockQuantity === 0);
    res.json({ success: true, count: outOfStock.length, data: outOfStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/inventory/critical
exports.getCritical = async (req, res) => {
  try {
    const cache = getMemoryInventory();
    const critical = cache.filter(p => p.status === 'LOW' || p.status === 'OUT_OF_STOCK' || (p.availableQuantity !== undefined ? p.availableQuantity <= 30 : p.stockQuantity <= 30));
    res.json({ success: true, count: critical.length, data: critical });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/inventory/:productId
exports.getInventoryByProductId = async (req, res) => {
  try {
    const cache = getMemoryInventory();
    const item = cache.find(p => p.productId === req.params.productId || p.id === req.params.productId);
    if (!item) return res.status(404).json({ success: false, message: 'Inventory record not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports.getMemoryInventory = getMemoryInventory;
module.exports.memoryStockMovements = memoryStockMovements;
