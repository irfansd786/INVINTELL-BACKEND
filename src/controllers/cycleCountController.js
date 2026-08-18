const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCSVInventory, getCSVProducts } = require('../data/csvDataLoader');

// In-memory cycle counts fallback if DB offline
let memoryCycleCounts = [
  {
    id: 'cc-1001',
    countNumber: 'CC-2026-1001',
    warehouseName: 'Warehouse A (Chicago Hub)',
    status: 'IN_PROGRESS',
    startedAt: '2026-08-16 09:00',
    completedAt: null,
    notes: 'Q3 Regional Hub Audit',
    items: [
      { id: 'cci-1', productName: 'Groceries Item P0001', sku: 'SKU-P0001', barcode: '8901000000011', expectedQuantity: 150, countedQuantity: 148, variance: -2, status: 'DISCREPANCY' },
      { id: 'cci-2', productName: 'Toys Item P0002', sku: 'SKU-P0002', barcode: '8901000000028', expectedQuantity: 80, countedQuantity: 80, variance: 0, status: 'MATCHED' }
    ]
  }
];

// GET /api/cycle-counts
exports.getCycleCounts = async (req, res) => {
  try {
    let counts = [];
    try {
      counts = await prisma.cycleCount.findMany({
        include: { store: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    if (!counts || counts.length === 0) {
      counts = memoryCycleCounts;
    }

    res.json({ success: true, count: counts.length, data: counts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/cycle-counts
exports.createCycleCount = async (req, res) => {
  try {
    const { warehouseName, notes } = req.body;
    const countNumber = `CC-2026-${Math.floor(Math.random() * 9000) + 1000}`;
    const products = getCSVProducts();
    const inventory = getCSVInventory();

    const items = products.slice(0, 6).map((p, idx) => {
      const invMatch = inventory.find(i => i.productId === p.productId || i.id === p.id);
      const expected = invMatch ? (invMatch.inventoryLevel || invMatch.stockQuantity || 100) : 100;
      return {
        id: `cci-${Date.now()}-${idx}`,
        productId: p.id || p.productId,
        productName: p.name || p.productName,
        sku: p.sku || p.productId,
        barcode: p.barcode || `89010000000${idx + 1}0`,
        expectedQuantity: expected,
        countedQuantity: null,
        variance: 0,
        status: 'PENDING'
      };
    });

    const newCount = {
      id: `cc-${Date.now()}`,
      countNumber,
      warehouseName: warehouseName || 'Warehouse A (Chicago Hub)',
      status: 'IN_PROGRESS',
      startedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      completedAt: null,
      notes: notes || 'Physical Cycle Count Audit',
      items
    };

    memoryCycleCounts.unshift(newCount);
    res.status(201).json({ success: true, message: 'Cycle count audit initialized', data: newCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/cycle-counts/:id
exports.getCycleCountById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = memoryCycleCounts.find(c => c.id === id || c.countNumber === id);
    if (!item) return res.status(404).json({ success: false, message: 'Cycle count audit record not found' });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/cycle-counts/:id/items - Update scanned item count
exports.updateCountItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemId, barcode, countedQuantity } = req.body;

    const countObj = memoryCycleCounts.find(c => c.id === id || c.countNumber === id);
    if (!countObj) return res.status(404).json({ success: false, message: 'Cycle count audit record not found' });

    let item = null;
    if (itemId) {
      item = countObj.items.find(i => i.id === itemId);
    } else if (barcode) {
      const clean = String(barcode).trim().toLowerCase();
      item = countObj.items.find(i => String(i.barcode).toLowerCase() === clean || String(i.sku).toLowerCase() === clean);
    }

    if (!item) return res.status(404).json({ success: false, message: 'Item not found in this cycle count audit sheet' });

    const qty = parseInt(countedQuantity, 10);
    item.countedQuantity = qty;
    item.variance = qty - item.expectedQuantity;
    item.status = item.variance === 0 ? 'MATCHED' : 'DISCREPANCY';

    return res.json({ success: true, message: `Item ${item.sku} count updated: ${qty} (Variance: ${item.variance})`, data: item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/cycle-counts/:id/complete - Finalize Cycle Count & adjust inventory
exports.completeCycleCount = async (req, res) => {
  try {
    const { id } = req.params;
    const countObj = memoryCycleCounts.find(c => c.id === id || c.countNumber === id);
    if (!countObj) return res.status(404).json({ success: false, message: 'Cycle count audit record not found' });

    countObj.status = 'COMPLETED';
    countObj.completedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);

    // Apply inventory adjustments for discrepancies
    const { memoryStockMovements } = require('./inventoryController');
    countObj.items.forEach(item => {
      if (item.countedQuantity !== null && item.variance !== 0) {
        memoryStockMovements.unshift({
          id: `mov-cc-${Date.now()}-${item.id}`,
          movementId: `MOV-CC-${Math.floor(Math.random() * 9000) + 1000}`,
          productName: item.productName,
          sku: item.sku,
          warehouseName: countObj.warehouseName,
          movementType: 'ADJUSTMENT',
          quantity: item.variance,
          date: new Date().toISOString().replace('T', ' ').substring(0, 16),
          reason: `Cycle Count ${countObj.countNumber} Physical Audit Variance (${item.variance > 0 ? '+' : ''}${item.variance})`
        });
      }
    });

    return res.json({
      success: true,
      message: `Cycle count ${countObj.countNumber} finalized and stock variance reconciled`,
      data: countObj
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
