const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCSVOrders, getCSVRisks, getCSVProducts, getCSVStores } = require('../data/csvDataLoader');

// In-memory operational store fallback if DB is offline
let memoryAllocations = null;
let memoryPicking = null;
let memoryPacking = null;
let memoryDispatch = null;
let memoryExceptions = null;
let memoryTransfers = null;
let memorySuppliers = null;

function initMemoryStores() {
  if (!memoryAllocations) {
    const orders = getCSVOrders();
    memoryAllocations = orders.map((o, idx) => ({
      id: `alloc-csv-${idx + 1}`,
      allocationId: `ALLOC-${1001 + idx}`,
      orderId: o.id || `ORD-2022-${9001 + idx}`,
      orderNumber: o.orderNumber || o.id || `ORD-2022-${9001 + idx}`,
      customerName: o.customerName || `CSV Commercial Client ${idx + 1}`,
      productName: o.productName || 'Industrial Product Line',
      sku: o.sku || 'SKU-P0001',
      requestedQuantity: o.totalItems || o.quantity || 10,
      allocatedQuantity: o.totalItems || o.quantity || 10,
      warehouseName: o.warehouseName || 'Warehouse A (Chicago Hub)',
      status: idx % 3 === 0 ? 'PENDING' : 'ALLOCATED',
      priority: o.priority || 'STANDARD',
      createdAt: o.createdAt || '2026-08-16'
    }));
  }

  if (!memoryPicking) {
    memoryPicking = [
      { id: "pick-201", pickingId: "PK-9041", orderId: "ord-301", orderNumber: "ORD-2022-9003", sku: "SKU-P0003", productName: "Toys Item P0003", binLocation: "A-12-04", warehouseName: "Warehouse A (Chicago Hub)", quantity: 51, totalUnits: 51, pickedQuantity: 51, pickerName: "John Miller", status: "IN_PROGRESS", SLA: "14 mins left" },
      { id: "pick-202", pickingId: "PK-9042", orderId: "ord-302", orderNumber: "ORD-2022-9007", sku: "SKU-P0007", productName: "Furniture Item P0007", binLocation: "B-04-11", warehouseName: "Warehouse B (Dallas Hub)", quantity: 167, totalUnits: 167, pickedQuantity: 100, pickerName: "Sarah Davis", status: "PENDING", SLA: "30 mins left" },
      { id: "pick-203", pickingId: "PK-9043", orderId: "ord-303", orderNumber: "ORD-2022-9013", sku: "SKU-P0013", productName: "Toys Item P0013", binLocation: "C-09-02", warehouseName: "Warehouse C (Los Angeles Hub)", quantity: 85, totalUnits: 85, pickedQuantity: 85, pickerName: "Robert Chen", status: "COMPLETED", SLA: "On Time" },
      { id: "pick-204", pickingId: "PK-9044", orderId: "ord-304", orderNumber: "ORD-2022-9001", sku: "SKU-P0001", productName: "Groceries Item P0001", binLocation: "A-02-08", warehouseName: "Warehouse A (Chicago Hub)", quantity: 127, totalUnits: 127, pickedQuantity: 127, pickerName: "John Miller", status: "COMPLETED", SLA: "On Time" }
    ];
  }

  if (!memoryPacking) {
    memoryPacking = [
      { id: "pack-301", packingId: "PAC-4011", orderId: "ord-301", orderNumber: "ORD-2022-9004", sku: "SKU-P0004", warehouseName: "Warehouse A (Chicago Hub)", quantity: 164, boxType: "LARGE_CORRUGATED", packerName: "Dave Evans", status: "PACKED", weightKg: "14.2 kg" },
      { id: "pack-302", packingId: "PAC-4012", orderId: "ord-302", orderNumber: "ORD-2022-9010", sku: "SKU-P0010", warehouseName: "Warehouse A (Chicago Hub)", quantity: 196, boxType: "HEAVY_DUTY_FOAM", packerName: "Linda Scott", status: "IN_PROGRESS", weightKg: "18.8 kg" },
      { id: "pack-303", packingId: "PAC-4013", orderId: "ord-303", orderNumber: "ORD-2022-9011", sku: "SKU-P0011", warehouseName: "Warehouse B (Dallas Hub)", quantity: 153, boxType: "MEDIUM_CORRUGATED", packerName: "Dave Evans", status: "PACKED", weightKg: "11.5 kg" }
    ];
  }

  if (!memoryDispatch) {
    memoryDispatch = [
      { id: "disp-401", dispatchId: "MAN-7091", orderId: "ord-401", orderNumber: "ORD-2022-9005", customerName: "CSV Commercial Client 5", carrier: "FedEx Freight", trackingId: "FX-940281-US", warehouseName: "Warehouse C (Los Angeles Hub)", status: "DISPATCHED", dispatchDate: "2026-08-16 11:45" },
      { id: "disp-402", dispatchId: "MAN-7092", orderId: "ord-402", orderNumber: "ORD-2022-9009", customerName: "CSV Commercial Client 9", carrier: "UPS Ground", trackingId: "1Z-999-001-884", warehouseName: "Warehouse C (Los Angeles Hub)", status: "READY", dispatchDate: "2026-08-16 14:20" }
    ];
  }

  if (!memoryExceptions) {
    memoryExceptions = [
      { id: "exc-501", exceptionCode: "EXP-BIN-MISMATCH", title: "Bin Mismatch at Warehouse A", description: "System reported bin A-12-04 empty during picking task PK-9041.", warehouseName: "Warehouse A (Chicago Hub)", type: "SHORTAGE", severity: "HIGH", status: "OPEN", assignedTo: "Inventory Lead", createdAt: "2026-08-16 08:30" },
      { id: "exc-502", exceptionCode: "EXP-BARCODE-UNREADABLE", title: "Unreadable Barcode Tag SKU-P0003", description: "Scanner failed verification attempts during packing at Warehouse B.", warehouseName: "Warehouse B (Dallas Hub)", type: "QUANTITY_MISMATCH", severity: "MEDIUM", status: "INVESTIGATING", assignedTo: "QA Specialist", createdAt: "2026-08-16 10:45" },
      { id: "exc-503", exceptionCode: "EXP-DAMAGED-BOX-503", title: "Damaged Outer Packaging Claim", description: "Package inspected and approved after minor carton replacement.", warehouseName: "Warehouse C (Los Angeles Hub)", type: "DAMAGED_GOODS", severity: "LOW", status: "RESOLVED", assignedTo: "Fulfillment Lead", createdAt: "2026-08-15 14:20" }
    ];
  }

  if (!memoryTransfers) {
    memoryTransfers = [
      { id: "tr-801", transferId: "TR-801", productName: "Groceries Item P0006", sku: "SKU-P0006", fromWarehouse: "Warehouse A (Chicago Hub)", toWarehouse: "Warehouse B (Dallas Hub)", quantity: 50, status: "IN_TRANSIT", requestedDate: "2026-08-15" },
      { id: "tr-802", transferId: "TR-802", productName: "Toys Item P0003", sku: "SKU-P0003", fromWarehouse: "Warehouse C (Los Angeles Hub)", toWarehouse: "Warehouse B (Dallas Hub)", quantity: 100, status: "APPROVED", requestedDate: "2026-08-16" }
    ];
  }

  if (!memorySuppliers) {
    memorySuppliers = [
      { supplierId: 'SUP-001', name: 'Global Apex Logistics & Supply', contact: 'Mark Vance', email: 'supply@globalapex.com', location: 'Chicago, IL', reliabilityScore: 98.5, status: 'ACTIVE' },
      { supplierId: 'SUP-002', name: 'Nexus Component Tech', contact: 'Elena Rostova', email: 'orders@nexuscomp.io', location: 'Dallas, TX', reliabilityScore: 96.2, status: 'ACTIVE' },
      { supplierId: 'SUP-003', name: 'Pacific Rim Goods Co.', contact: 'Kenji Sato', email: 'b2b@pacificrim.jp', location: 'Los Angeles, CA', reliabilityScore: 99.1, status: 'ACTIVE' },
      { supplierId: 'SUP-004', name: 'Vanguard Industrial Wholesale', contact: 'Sarah Jenkins', email: 'fulfillment@vanguard.com', location: 'Atlanta, GA', reliabilityScore: 95.8, status: 'ACTIVE' },
      { supplierId: 'SUP-005', name: 'Horizon Electronics Ltd.', contact: 'David Kim', email: 'sales@horizonelec.kr', location: 'Seattle, WA', reliabilityScore: 97.4, status: 'ACTIVE' }
    ];
  }
}

// Ensure memory stores initialized
initMemoryStores();

// GET /api/suppliers
exports.getSuppliers = async (req, res) => {
  try {
    let suppliers = [];
    try {
      suppliers = await prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } });
    } catch (e) {}

    if (!suppliers || suppliers.length === 0) {
      suppliers = memorySuppliers;
    }

    res.json({ success: true, count: suppliers.length, data: suppliers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/stock-movements
exports.getStockMovements = async (req, res) => {
  try {
    let movements = [];
    try {
      movements = await prisma.stockMovement.findMany({
        include: { product: true, store: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    if (!movements || movements.length === 0) {
      const { memoryStockMovements } = require('./inventoryController');
      movements = memoryStockMovements && memoryStockMovements.length > 0 ? memoryStockMovements : [
        { id: 'mov-101', movementId: 'MOV-1001', productName: 'Groceries Item P0001', sku: 'SKU-P0001', warehouseName: 'Warehouse A (Chicago Hub)', movementType: 'INBOUND', quantity: 150, date: '2026-08-16 09:15', reason: 'Supplier Delivery' },
        { id: 'mov-102', movementId: 'MOV-1002', productName: 'Toys Item P0002', sku: 'SKU-P0002', warehouseName: 'Warehouse A (Chicago Hub)', movementType: 'OUTBOUND', quantity: 25, date: '2026-08-16 10:30', reason: 'Customer Order Allocation' }
      ];
    }

    res.json({ success: true, count: movements.length, data: movements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/allocations
exports.getAllocations = async (req, res) => {
  try {
    let allocations = [];
    try {
      allocations = await prisma.allocation.findMany({
        include: { order: true, store: true, product: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    if (!allocations || allocations.length === 0) {
      allocations = memoryAllocations;
    }

    res.json({ success: true, count: allocations.length, data: allocations });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/allocations - Perform Order Stock Allocation
exports.performAllocation = async (req, res) => {
  try {
    const { orderId, warehouseName } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required for allocation' });
    }

    const { getMemoryOrders } = require('./orderController');
    const orders = getMemoryOrders();
    let order = orders.find(o => o.id === orderId || o.orderNumber === orderId);

    // Resolve order if orderId is an allocation ID
    if (!order && memoryAllocations) {
      const matchAlloc = memoryAllocations.find(a => a.id === orderId || a.allocationId === orderId);
      if (matchAlloc) {
        order = orders.find(o => o.id === matchAlloc.orderId || o.orderNumber === matchAlloc.orderNumber);
      }
    }

    const { getMemoryInventory } = require('./inventoryController');
    const inventory = getMemoryInventory();

    const targetWh = warehouseName || order?.warehouseName || 'Warehouse A (Chicago Hub)';
    const requestedQty = order?.items || order?.totalItems || 10;
    const prodId = order?.productId || 'P0001';

    // Find matching inventory
    const invItem = inventory.find(i => 
      (i.productId === prodId || i.sku === order?.sku) && 
      (i.warehouseName === targetWh || i.storeId === targetWh)
    ) || inventory[0];

    const availableStock = invItem ? (invItem.availableQuantity !== undefined ? invItem.availableQuantity : invItem.stockQuantity) : 0;

    // Check inventory stock availability - reject if shortage
    if (availableStock < requestedQty) {
      return res.status(400).json({
        success: false,
        message: `Allocation failed due to stock shortage: Requested ${requestedQty} units of ${order?.productName || prodId}, but only ${availableStock} units available at ${targetWh}.`,
        requestedQuantity: requestedQty,
        availableQuantity: availableStock
      });
    }

    // Reserve stock atomically
    if (invItem) {
      invItem.reservedQuantity = (invItem.reservedQuantity || 0) + requestedQty;
      invItem.availableQuantity = Math.max(0, availableStock - requestedQty);
    }

    // Update order status if order found
    if (order) {
      order.status = 'ALLOCATED';
    }

    // Memory Store update
    const index = memoryAllocations.findIndex(a => a.id === orderId || a.orderId === orderId || a.orderNumber === orderId);
    let allocRecord = null;
    if (index >= 0) {
      memoryAllocations[index].status = 'ALLOCATED';
      memoryAllocations[index].allocatedQuantity = requestedQty;
      memoryAllocations[index].warehouseName = targetWh;
      allocRecord = memoryAllocations[index];
    } else {
      allocRecord = {
        id: `alloc-${Date.now()}`,
        allocationId: `ALLOC-${Math.floor(1000 + Math.random() * 9000)}`,
        orderId: orderId,
        orderNumber: order?.orderNumber || orderId,
        customerName: order?.customerName || 'Commercial Client',
        productName: order?.productName || 'Inventory Item',
        sku: order?.sku || 'SKU-P0001',
        requestedQuantity: requestedQty,
        allocatedQuantity: requestedQty,
        warehouseName: targetWh,
        status: 'ALLOCATED',
        createdAt: new Date().toISOString().split('T')[0]
      };
      memoryAllocations.unshift(allocRecord);
    }

    return res.json({
      success: true,
      message: `Order ${orderId} successfully allocated ${requestedQty} units at ${targetWh}`,
      data: allocRecord
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/picking
exports.getPicking = async (req, res) => {
  try {
    let picking = [];
    try {
      picking = await prisma.pickingTask.findMany({
        include: { order: true, store: true, product: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    if (!picking || picking.length === 0) {
      picking = memoryPicking;
    }

    res.json({ success: true, count: picking.length, data: picking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/picking/:id/complete - Complete picking task
exports.completePickingTask = async (req, res) => {
  try {
    const { id } = req.params;
    const index = memoryPicking.findIndex(p => p.id === id || p.pickingId === id || p.pickTicketNumber === id);
    
    if (index < 0) {
      return res.status(404).json({ success: false, message: `Picking task not found for ID: ${id}` });
    }

    const task = memoryPicking[index];
    if (task.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: `Picking task ${id} is already completed` });
    }

    // Sync order status
    const { getMemoryOrders } = require('./orderController');
    const orders = getMemoryOrders();
    const associatedOrder = orders.find(o => o.id === task.orderId || o.orderNumber === task.orderNumber);
    if (associatedOrder) {
      associatedOrder.status = 'PICKED';
    }

    memoryPicking[index].status = 'COMPLETED';
    memoryPicking[index].pickedQuantity = memoryPicking[index].quantity || memoryPicking[index].totalUnits || 50;

    return res.json({
      success: true,
      message: `Picking task ${id} completed successfully. Order marked as PICKED.`,
      data: memoryPicking[index]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/packing
exports.getPacking = async (req, res) => {
  try {
    let packing = [];
    try {
      packing = await prisma.packingTask.findMany({
        include: { order: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    if (!packing || packing.length === 0) {
      packing = memoryPacking;
    }

    res.json({ success: true, count: packing.length, data: packing });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/packing/:id/complete - Mark packed
exports.completePackingTask = async (req, res) => {
  try {
    const { id } = req.params;
    const index = memoryPacking.findIndex(p => p.id === id || p.packId === id || p.packingId === id);
    
    if (index < 0) {
      return res.status(404).json({ success: false, message: `Packing task not found for ID: ${id}` });
    }

    const task = memoryPacking[index];

    // Verify associated order state is picked before packing
    const { getMemoryOrders } = require('./orderController');
    const orders = getMemoryOrders();
    const associatedOrder = orders.find(o => o.id === task.orderId || o.orderNumber === task.orderNumber);
    
    if (associatedOrder && associatedOrder.status !== 'PICKED' && associatedOrder.status !== 'PACKING' && associatedOrder.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Packing failed: Order ${associatedOrder.orderNumber || task.orderNumber} must be in PICKED status before packing. Current status: ${associatedOrder.status}`
      });
    }

    if (associatedOrder) {
      associatedOrder.status = 'PACKED';
    }

    memoryPacking[index].status = 'PACKED';

    return res.json({
      success: true,
      message: `Packing task ${id} verified and packed. Order marked as PACKED.`,
      data: memoryPacking[index]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/dispatch
exports.getDispatch = async (req, res) => {
  try {
    let dispatch = [];
    try {
      dispatch = await prisma.dispatch.findMany({
        include: { order: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    if (!dispatch || dispatch.length === 0) {
      dispatch = memoryDispatch;
    }

    res.json({ success: true, count: dispatch.length, data: dispatch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/dispatch/:id/confirm - Confirm Dispatch
exports.confirmDispatch = async (req, res) => {
  try {
    const { id } = req.params;
    const index = memoryDispatch.findIndex(d => d.id === id || d.dispatchId === id || d.dispatchManifest === id);
    
    if (index < 0) {
      return res.status(404).json({ success: false, message: `Dispatch record not found for ID: ${id}` });
    }

    const task = memoryDispatch[index];

    // Verify order state before dispatch
    const { getMemoryOrders } = require('./orderController');
    const orders = getMemoryOrders();
    const associatedOrder = orders.find(o => o.id === task.orderId || o.orderNumber === task.orderNumber);

    if (associatedOrder && associatedOrder.status !== 'PACKED' && associatedOrder.status !== 'DISPATCHED' && associatedOrder.status !== 'FULFILLED' && associatedOrder.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Dispatch failed: Order ${associatedOrder.orderNumber || task.orderNumber} must be in PACKED status before dispatching. Current status: ${associatedOrder.status}`
      });
    }

    if (associatedOrder) {
      associatedOrder.status = 'DISPATCHED';
    }

    memoryDispatch[index].status = 'DISPATCHED';

    return res.json({
      success: true,
      message: `Dispatch manifest ${id} confirmed and dispatched. Order marked as DISPATCHED.`,
      data: memoryDispatch[index]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/exceptions
exports.getExceptions = async (req, res) => {
  try {
    let exceptions = [];
    try {
      exceptions = await prisma.exception.findMany({
        include: { order: true, store: true, product: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    if (!exceptions || exceptions.length === 0) {
      exceptions = memoryExceptions;
    }

    res.json({ success: true, count: exceptions.length, data: exceptions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/exceptions - Report new exception
exports.createException = async (req, res) => {
  try {
    const { title, description, warehouseName, severity, type, orderId, productId } = req.body;
    
    if (!title && !description) {
      return res.status(400).json({ success: false, message: 'Exception title or description is required' });
    }

    const newExc = {
      id: `exc-${Date.now()}`,
      exceptionCode: `EXP-${Date.now().toString().substring(7)}`,
      title: title || 'Operational Exception',
      description: description || 'Flagged by warehouse staff',
      warehouseName: warehouseName || 'Warehouse A (Chicago Hub)',
      type: (type || 'SHORTAGE').toUpperCase(),
      severity: (severity || 'HIGH').toUpperCase(),
      orderId: orderId || null,
      productId: productId || null,
      status: 'OPEN',
      assignedTo: 'Operations Lead',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    memoryExceptions.unshift(newExc);
    return res.status(201).json({ success: true, message: 'Exception logged successfully', data: newExc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/exceptions/:id/resolve - Resolve Exception
exports.resolveException = async (req, res) => {
  try {
    const { id } = req.params;
    const index = memoryExceptions.findIndex(e => e.id === id || e.exceptionCode === id);
    if (index < 0) {
      return res.status(404).json({ success: false, message: `Exception not found for ID: ${id}` });
    }

    memoryExceptions[index].status = 'RESOLVED';
    memoryExceptions[index].resolvedAt = new Date().toISOString();

    return res.json({
      success: true,
      message: `Exception ${id} resolved successfully`,
      data: memoryExceptions[index]
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/transfers
exports.getTransfers = async (req, res) => {
  try {
    let transfers = [];
    try {
      transfers = await prisma.warehouseTransfer.findMany({
        include: { product: true, fromStore: true, toStore: true },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    if (!transfers || transfers.length === 0) {
      transfers = memoryTransfers;
    }

    res.json({ success: true, count: transfers.length, data: transfers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/transfers - Create transfer request with stock validation
exports.createTransfer = async (req, res) => {
  try {
    const { productName, sku, fromWarehouse, toWarehouse, quantity } = req.body;

    const qty = parseInt(quantity || 0, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Transfer quantity must be greater than 0' });
    }

    const source = (fromWarehouse || '').trim();
    const dest = (toWarehouse || '').trim();

    if (source && dest && source.toLowerCase() === dest.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: `Transfer rejected: Source warehouse and destination warehouse cannot be identical (${source}).`
      });
    }

    // Verify stock availability at source warehouse
    const { getMemoryInventory } = require('./inventoryController');
    const inventory = getMemoryInventory();
    
    const sourceInv = inventory.find(i => 
      (i.sku === sku || i.productName === productName) && 
      (i.warehouseName === source || i.storeId === source)
    ) || inventory.find(i => i.warehouseName === source);

    const availableAtSource = sourceInv ? (sourceInv.availableQuantity !== undefined ? sourceInv.availableQuantity : sourceInv.stockQuantity) : 100;

    if (availableAtSource < qty) {
      return res.status(400).json({
        success: false,
        message: `Transfer failed due to stock shortage: Requested ${qty} units from ${source}, but only ${availableAtSource} units available.`,
        requestedQuantity: qty,
        availableQuantity: availableAtSource
      });
    }

    // Atomically transfer stock in memory
    if (sourceInv) {
      sourceInv.stockQuantity = Math.max(0, sourceInv.stockQuantity - qty);
      sourceInv.availableQuantity = Math.max(0, (sourceInv.availableQuantity || sourceInv.stockQuantity) - qty);
    }

    const destInv = inventory.find(i => 
      (i.sku === sku || i.productName === productName) && 
      (i.warehouseName === dest || i.storeId === dest)
    );

    if (destInv) {
      destInv.stockQuantity += qty;
      destInv.availableQuantity = (destInv.availableQuantity || destInv.stockQuantity) + qty;
    }

    const newTransfer = {
      id: `tr-${Date.now()}`,
      transferId: `TR-${Math.floor(Math.random() * 900) + 100}`,
      productName: productName || 'Enterprise Component',
      sku: sku || 'SKU-P0001',
      fromWarehouse: source || 'Warehouse A (Chicago Hub)',
      toWarehouse: dest || 'Warehouse B (Dallas Hub)',
      quantity: qty,
      status: 'APPROVED',
      requestedDate: new Date().toISOString().split('T')[0]
    };

    memoryTransfers.unshift(newTransfer);

    return res.status(201).json({
      success: true,
      message: `Transfer of ${qty} units of ${newTransfer.productName} from ${newTransfer.fromWarehouse} to ${newTransfer.toWarehouse} approved and processed`,
      data: newTransfer
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMemoryPicking = () => { initMemoryStores(); return memoryPicking; };
exports.getMemoryPacking = () => { initMemoryStores(); return memoryPacking; };
exports.getMemoryDispatch = () => { initMemoryStores(); return memoryDispatch; };

