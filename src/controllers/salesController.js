const prisma = require('../config/db');
const { 
  PRODUCT_SALES_PERFORMANCE, 
  FINANCE_SUMMARY, 
  REVENUE_TREND 
} = require('../data/defaultData');

// GET /api/sales
exports.getSales = async (req, res) => {
  try {
    res.json({ success: true, count: PRODUCT_SALES_PERFORMANCE.length, data: PRODUCT_SALES_PERFORMANCE });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sales/summary
exports.getSalesSummary = async (req, res) => {
  try {
    res.json({ success: true, data: FINANCE_SUMMARY });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/sales/trends
exports.getSalesTrends = async (req, res) => {
  try {
    res.json({ success: true, data: REVENUE_TREND });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
