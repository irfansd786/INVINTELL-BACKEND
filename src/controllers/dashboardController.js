const prisma = require('../config/db');
const { 
  PRODUCT_SALES_PERFORMANCE, 
  REVENUE_TREND, 
  WAREHOUSE_SALES_PERFORMANCE 
} = require('../data/defaultData');

// GET /api/dashboard/summary
exports.getDashboardSummary = async (req, res) => {
  try {
    const summary = {
      totalProducts: 20,
      totalInventoryItems: 73100,
      activeStores: 5,
      totalRevenue: 4850200,
      pendingOrders: 14,
      criticalRisks: 3,
      systemHealth: 98.4
    };
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/dashboard/sales
exports.getDashboardSales = async (req, res) => {
  try {
    res.json({ success: true, data: REVENUE_TREND });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/dashboard/inventory
exports.getDashboardInventory = async (req, res) => {
  try {
    res.json({ success: true, data: WAREHOUSE_SALES_PERFORMANCE });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/dashboard/top-products
exports.getDashboardTopProducts = async (req, res) => {
  try {
    const topProducts = [...PRODUCT_SALES_PERFORMANCE].sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 5);
    res.json({ success: true, data: topProducts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/dashboard/low-stock
exports.getDashboardLowStock = async (req, res) => {
  try {
    const lowStock = PRODUCT_SALES_PERFORMANCE.filter(p => (p.stockQuantity || p.inventoryLevel) < 150);
    res.json({ success: true, data: lowStock });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
