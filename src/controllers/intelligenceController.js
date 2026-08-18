const { 
  analyzeDemand, 
  generateDemandForecasts, 
  calculateStockCoverageAndReorder, 
  evaluateProductRiskScore, 
  getPrioritizedBatches, 
  calculateFinancialMetrics, 
  generateBusinessInsights 
} = require('../services/intelligenceEngine');

const { getCSVProducts, getCSVInventory, getCSVOrders, getCSVRisks } = require('../data/csvDataLoader');

// GET /api/intelligence/demand
exports.getDemandAnalysis = async (req, res) => {
  try {
    const products = getCSVProducts();
    const orders = getCSVOrders();

    const analysisList = products.map(p => analyzeDemand(p, orders));
    res.json({ success: true, count: analysisList.length, data: analysisList });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/intelligence/reorder
exports.getReorderRecommendations = async (req, res) => {
  try {
    const products = getCSVProducts();
    const inventory = getCSVInventory();
    const orders = getCSVOrders();

    const recommendations = products.map(p => {
      const invMatch = inventory.find(i => i.productId === p.productId || i.id === p.id);
      const physicalStock = invMatch ? (invMatch.inventoryLevel || invMatch.stockQuantity || 100) : (p.stockQuantity || 100);
      const dAnalysis = analyzeDemand(p, orders);
      return calculateStockCoverageAndReorder(p, physicalStock, dAnalysis, 7, 5);
    });

    res.json({ success: true, count: recommendations.length, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/intelligence/fefo-batches
exports.getFEFOBatches = async (req, res) => {
  try {
    const { productId } = req.query;

    const sampleBatches = [
      { id: 'batch-901', batchNumber: 'BAT-2026-0901', productId: 'P0001', productName: 'Groceries Item P0001', expiryDate: '2026-09-10', quantity: 150 },
      { id: 'batch-902', batchNumber: 'BAT-2026-0902', productId: 'P0001', productName: 'Groceries Item P0001', expiryDate: '2026-11-25', quantity: 200 },
      { id: 'batch-903', batchNumber: 'BAT-2026-0903', productId: 'P0001', productName: 'Groceries Item P0001', expiryDate: '2026-08-01', quantity: 50 }, // Expired
      { id: 'batch-904', batchNumber: 'BAT-2026-0904', productId: 'P0003', productName: 'Toys Item P0003', expiryDate: '2026-09-05', quantity: 80 },
      { id: 'batch-905', batchNumber: 'BAT-2026-0905', productId: 'P0005', productName: 'Electronics Item P0005', expiryDate: '2026-10-15', quantity: 120 }
    ];

    let targetBatches = sampleBatches;
    if (productId) {
      targetBatches = sampleBatches.filter(b => b.productId === productId);
    }

    const fefoEval = getPrioritizedBatches(targetBatches);

    res.json({
      success: true,
      productId: productId || 'ALL',
      data: fefoEval.prioritizedBatches,
      sellableCount: fefoEval.sellableBatches.length,
      expiredCount: fefoEval.expiredBatches.length,
      nextToExpireBatch: fefoEval.nextToExpireBatch
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/intelligence/insights
exports.getInsights = async (req, res) => {
  try {
    const products = getCSVProducts();
    const inventory = getCSVInventory();
    const orders = getCSVOrders();

    const insights = generateBusinessInsights(products, inventory, orders);
    res.json({ success: true, count: insights.length, data: insights });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
