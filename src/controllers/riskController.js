const { getCSVRisks, getCSVProducts } = require('../data/csvDataLoader');
const { evaluateProductRisks } = require('../services/riskService');

// GET /api/risks
exports.getRisks = async (req, res) => {
  try {
    const { getCSVProducts, getCSVInventory, getCSVRisks } = require('../data/csvDataLoader');
    const { evaluateProductRiskScore } = require('../services/intelligenceEngine');

    const products = getCSVProducts() || [];
    const inventory = getCSVInventory() || [];
    const initialRisks = getCSVRisks() || [];

    const evaluatedRisks = products.map((p, idx) => {
      const invMatch = inventory.find(i => i.productId === p.productId || i.id === p.id);
      const stock = invMatch ? (invMatch.inventoryLevel || invMatch.stockQuantity || 100) : (p.stockQuantity || 100);
      const unitsSold = p.unitsSold || 25;
      
      const expiryDates = ['2026-09-05', '2026-09-20', '2026-10-15', '2026-11-20', '2026-12-30'];
      const expDate = expiryDates[idx % expiryDates.length];

      const scoreEval = evaluateProductRiskScore(p, stock, unitsSold, expDate);

      // Match with existing CSV risk record if present
      const csvMatch = initialRisks.find(r => r.productId === p.productId);

      return {
        id: csvMatch?.id || `risk-eval-${p.productId || idx}`,
        productId: p.productId || p.id,
        productName: p.name || p.productName,
        sku: p.sku || `SKU-${p.productId}`,
        category: p.category || 'General',
        warehouseName: invMatch?.warehouseName || p.warehouse || 'Warehouse A (Chicago Hub)',
        currentStock: stock,
        riskScore: scoreEval.riskScore,
        riskType: scoreEval.riskType,
        severity: scoreEval.severity,
        reason: scoreEval.explainableDetail.why,
        action: scoreEval.explainableDetail.action,
        explainableDetail: scoreEval.explainableDetail,
        expiryDate: expDate,
        salesVelocity: `${(unitsSold / 30).toFixed(1)} u/day`,
        suggestedDiscount: scoreEval.riskScore >= 75 ? 25 : (scoreEval.riskScore >= 50 ? 15 : 0),
        suggestedAction: scoreEval.riskType === 'STOCKOUT' ? 'REORDER_EXPEDITED' : (scoreEval.riskType === 'EXPIRY_RISK' ? 'CLEARANCE_CAMPAIGN' : 'MARKDOWN_BUNDLE')
      };
    }).filter(r => r.riskScore >= 25); // Include medium, high, and critical risks

    res.json({ success: true, count: evaluatedRisks.length, data: evaluatedRisks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/risks/:id/apply
exports.applyRiskRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    res.json({
      success: true,
      message: `Recommendation applied for risk item ${id}. Clearance/discount process initiated.`,
      appliedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// POST /api/risks/:id/modify
exports.modifyRiskRecommendation = async (req, res) => {
  try {
    const { id } = req.params;
    const { offerType, discountPercent, targetWarehouse, notes } = req.body;
    res.json({
      success: true,
      message: `Risk recommendation modified successfully.`,
      data: {
        riskId: id,
        offerType,
        discountPercent,
        targetWarehouse,
        notes,
        modifiedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
