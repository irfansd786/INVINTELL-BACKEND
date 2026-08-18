const prisma = require('../config/db');

const DEFAULT_STORES = [
  { id: 'wh-001', storeCode: 'S001', name: 'Warehouse A (Chicago Hub)', region: 'Midwest', address: 'Chicago, IL', status: 'ACTIVE', totalCapacity: 50000, currentStock: 18420 },
  { id: 'wh-002', storeCode: 'S002', name: 'Warehouse B (Dallas Hub)', region: 'South', address: 'Dallas, TX', status: 'ACTIVE', totalCapacity: 45000, currentStock: 14200 },
  { id: 'wh-003', storeCode: 'S003', name: 'Warehouse C (Los Angeles Hub)', region: 'West', address: 'Los Angeles, CA', status: 'ACTIVE', totalCapacity: 60000, currentStock: 21900 }
];

// GET /api/stores
exports.getStores = async (req, res) => {
  try {
    let stores = [];
    try {
      stores = await prisma.store.findMany({ take: 3 });
    } catch (e) {
      stores = [];
    }

    if (!stores || stores.length === 0) {
      stores = DEFAULT_STORES;
    } else {
      // Limit to 3 warehouses
      stores = stores.slice(0, 3);
    }

    res.json({ success: true, count: stores.length, data: stores });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/stores/:id
exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;
    let store = DEFAULT_STORES.find(s => s.id === id || s.storeCode === id) || DEFAULT_STORES[0];
    res.json({ success: true, data: store });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
