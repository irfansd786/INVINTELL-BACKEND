const { getCSVProducts, getCSVInventory, getCSVOrders } = require('../data/csvDataLoader');
const { analyzeDemand, generateDemandForecasts } = require('../services/intelligenceEngine');

// GET /api/forecasts (Moving-Average Demand Forecast 7/30/90 Days)
exports.getForecasts = async (req, res) => {
  try {
    const products = getCSVProducts();
    const inventory = getCSVInventory();
    const orders = getCSVOrders();

    const forecasts = products.map((p, idx) => {
      const invMatch = inventory.find(i => i.productId === p.productId || i.id === p.id);
      const currentStock = invMatch ? (invMatch.inventoryLevel || invMatch.stockQuantity || 120) : (p.stockQuantity || 120);
      
      const dAnalysis = analyzeDemand(p, orders);
      const fData = generateDemandForecasts(p, dAnalysis);

      return {
        id: `fc-10${idx + 1}`,
        productId: p.productId,
        productName: p.name || p.productName,
        sku: p.sku || p.productId,
        category: p.category,
        currentStock,
        avgDailyDemand: dAnalysis.avgDailyDemand,
        forecastDemand7Days: fData.forecast7Days,
        forecastDemand14Days: Math.round(fData.forecast7Days * 2),
        forecastDemand30Days: fData.forecast30Days,
        forecastDemand90Days: fData.forecast90Days,
        forecastDemand: fData.forecast30Days,
        trend: fData.trend,
        dataQuality: fData.qualityIndicator,
        confidenceScore: fData.confidenceScore,
        status: fData.trend === 'INCREASING' ? 'HIGHER_DEMAND' : currentStock > fData.forecast30Days * 2 ? 'OVERSTOCK_RISK' : 'STABLE'
      };
    });

    res.json({ success: true, count: forecasts.length, data: forecasts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
