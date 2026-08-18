const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCSVOrders } = require('../data/csvDataLoader');

// Memory store for operational order tracking
let memoryOrdersStore = null;

function getMemoryOrders() {
  if (!memoryOrdersStore) {
    const csvOrders = getCSVOrders();
    memoryOrdersStore = (csvOrders && csvOrders.length > 0) ? csvOrders.map(o => ({
      ...o,
      status: o.status || 'CREATED',
      priority: o.priority || 'STANDARD',
      totalItems: o.totalItems || o.items || 10,
      totalValue: o.totalValue || 250.00
    })) : [
      { id: "ord-2022-9001", orderNumber: "ORD-2022-9001", customerName: "CSV Commercial Client 1", productName: "Groceries Item P0001", sku: "SKU-P0001", items: 55, totalItems: 55, totalValue: 1474, status: "CREATED", priority: "URGENT", warehouseName: "Warehouse A (Chicago Hub)", createdAt: "2026-08-16" },
      { id: "ord-2022-9002", orderNumber: "ORD-2022-9002", customerName: "CSV Commercial Client 2", productName: "Toys Item P0002", sku: "SKU-P0002", items: 66, totalItems: 66, totalValue: 3326.93, status: "ALLOCATED", priority: "HIGH", warehouseName: "Warehouse A (Chicago Hub)", createdAt: "2026-08-16" }
    ];
  }
  return memoryOrdersStore;
}

// Strict Order Lifecycle State Transitions
const ALLOWED_ORDER_TRANSITIONS = {
  'CREATED': ['PENDING_ALLOCATION', 'ALLOCATED', 'CANCELLED'],
  'PENDING': ['PENDING_ALLOCATION', 'ALLOCATED', 'CANCELLED'],
  'PENDING_ALLOCATION': ['ALLOCATED', 'CANCELLED'],
  'ALLOCATED': ['PICKING', 'PICKED', 'CANCELLED'],
  'PICKING': ['PICKED', 'EXCEPTION', 'CANCELLED'],
  'PICKED': ['PACKING', 'PACKED', 'CANCELLED'],
  'PACKING': ['PACKED', 'EXCEPTION', 'CANCELLED'],
  'PACKED': ['DISPATCHED', 'CANCELLED'],
  'DISPATCHED': ['FULFILLED', 'COMPLETED'],
  'FULFILLED': [],
  'COMPLETED': [],
  'CANCELLED': []
};

function validateOrderTransition(currentStatus, nextStatus) {
  const current = (currentStatus || 'CREATED').toUpperCase();
  const next = (nextStatus || '').toUpperCase();

  if (current === next) return { valid: true };

  const allowed = ALLOWED_ORDER_TRANSITIONS[current] || [];
  if (!allowed.includes(next)) {
    return {
      valid: false,
      message: `Invalid order state transition: Cannot move order from '${current}' to '${next}'. Allowed transitions from '${current}': [${allowed.join(', ') || 'None'}]`
    };
  }
  return { valid: true };
}

// GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const { status, search } = req.query;
    let orders = [];
    try {
      orders = await prisma.order.findMany({
        include: { customer: true, store: true, items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {
      orders = [];
    }

    if (!orders || orders.length === 0) {
      orders = getMemoryOrders();
    }

    let filtered = [...orders];
    if (status && status !== 'ALL') {
      filtered = filtered.filter(o => (o.status || '').toUpperCase() === status.toUpperCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(o =>
        (o.orderNumber || o.id || '').toLowerCase().includes(q) ||
        (o.customerName || o.customer?.customerName || '').toLowerCase().includes(q) ||
        (o.productName || o.sku || '').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/orders/:id
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    let order = null;
    try {
      order = await prisma.order.findFirst({
        where: { OR: [{ id }, { orderNumber: id }] },
        include: { customer: true, store: true, items: { include: { product: true } } }
      });
    } catch (e) {}

    if (!order) {
      const store = getMemoryOrders();
      order = store.find(o => o.id === id || o.orderNumber === id);
    }

    if (!order) {
      return res.status(404).json({ success: false, message: `Order not found for ID: ${id}` });
    }

    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/orders - Create Order
exports.createOrder = async (req, res) => {
  try {
    const { customerName, productName, sku, productId, quantity, priority, warehouseName } = req.body;

    const qty = parseInt(quantity || 1, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer greater than 0' });
    }

    const orderNum = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const newOrder = {
      id: `ord-${Date.now()}`,
      orderNumber: orderNum,
      customerName: customerName || 'Commercial B2B Client',
      productName: productName || 'Standard Warehouse Product',
      productId: productId || 'P0001',
      sku: sku || 'SKU-P0001',
      items: qty,
      totalItems: qty,
      totalValue: Math.round(qty * 45.00 * 100) / 100,
      status: 'CREATED',
      priority: (priority || 'STANDARD').toUpperCase(),
      warehouseName: warehouseName || 'Warehouse A (Chicago Hub)',
      createdAt: new Date().toISOString().split('T')[0]
    };

    const store = getMemoryOrders();
    store.unshift(newOrder);

    res.status(201).json({
      success: true,
      message: `Order ${orderNum} created successfully`,
      data: newOrder
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/orders/:id/status - Update Order Status with Strict Transition Check
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status field is required' });
    }

    const store = getMemoryOrders();
    const orderIndex = store.findIndex(o => o.id === id || o.orderNumber === id);

    if (orderIndex < 0) {
      return res.status(404).json({ success: false, message: `Order not found: ${id}` });
    }

    const currentOrder = store[orderIndex];
    const validation = validateOrderTransition(currentOrder.status, status);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
        currentStatus: currentOrder.status,
        attemptedStatus: status
      });
    }

    store[orderIndex].status = status.toUpperCase();
    store[orderIndex].updatedAt = new Date().toISOString();

    res.json({
      success: true,
      message: `Order ${currentOrder.orderNumber || id} status updated to ${status.toUpperCase()}`,
      data: store[orderIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Export helper for operations controller state machine validation
exports.validateOrderTransition = validateOrderTransition;
exports.getMemoryOrders = getMemoryOrders;

