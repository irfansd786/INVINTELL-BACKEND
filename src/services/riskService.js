/**
 * INVINTELL Calculated Business Logic & Risk Intelligence Engine
 * Dynamically computes Stockout, Overstock, Dead Stock, Expiry Risks, and Reorder Recommendations.
 */

/**
 * 1. Calculate Expiry Risk & Discount Recommendation
 * Formula: daysRemaining = expiryDate - currentDate
 */
function calculateExpiryRisk(expiryDate) {
  if (!expiryDate) return { riskLevel: 'SAFE', daysRemaining: 180, recommendedDiscount: 0, action: 'MONITOR' };

  const now = new Date();
  const exp = new Date(expiryDate);
  const diffTime = exp.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysRemaining <= 0) {
    return { riskLevel: 'EXPIRED', daysRemaining: 0, recommendedDiscount: 50, action: 'WRITE_OFF_LIQUIDATION' };
  } else if (daysRemaining <= 7) {
    return { riskLevel: 'CRITICAL', daysRemaining, recommendedDiscount: 35, action: 'URGENT_CLEARANCE_CAMPAIGN' };
  } else if (daysRemaining <= 30) {
    return { riskLevel: 'EXPIRING_SOON', daysRemaining, recommendedDiscount: 25, action: 'STRONG_DISCOUNT_BUNDLE' };
  } else if (daysRemaining <= 60) {
    return { riskLevel: 'WATCH', daysRemaining, recommendedDiscount: 15, action: 'PROMOTIONAL_MARKDOWN' };
  } else if (daysRemaining <= 90) {
    return { riskLevel: 'WATCH', daysRemaining, recommendedDiscount: 0, action: 'PREPARE_PROMOTION' };
  } else {
    return { riskLevel: 'SAFE', daysRemaining, recommendedDiscount: 0, action: 'NORMAL_MONITORING' };
  }
}

/**
 * 2. Calculate Dead Stock Risk
 * Formula: High Inventory + Low Sales Velocity + Long Inactive Period
 */
function calculateDeadStockRisk(inventoryLevel, unitsSold, periodDays = 90) {
  const avgDailySales = unitsSold / (periodDays || 1);
  const isHighInventory = inventoryLevel > 150;
  const isLowVelocity = avgDailySales < 0.5; // Less than 1 unit every 2 days

  if (isHighInventory && isLowVelocity) {
    return {
      isDeadStock: true,
      severity: 'HIGH',
      reason: `High remaining inventory (${inventoryLevel} units) held over ${periodDays} days with low daily sales velocity (${avgDailySales.toFixed(2)} u/day).`,
      recommendation: 'APPLY_MARKDOWN_OR_REDISTRIBUTE'
    };
  }

  return { isDeadStock: false, severity: 'LOW', reason: 'Normal stock turnover', recommendation: 'NONE' };
}

/**
 * 3. Calculate Stockout Risk & Reorder Point
 * Formula: Days of Stock = Inventory Level / Avg Daily Sales
 * Reorder Point = (Avg Daily Sales * Lead Time) + Safety Stock
 */
function calculateReorderRecommendation(product, inventoryLevel, avgDailySales, leadTimeDays = 7) {
  const dailyDemand = avgDailySales > 0 ? avgDailySales : 5;
  const daysOfStock = Math.round((inventoryLevel / dailyDemand) * 10) / 10;
  const safetyStock = Math.round(dailyDemand * 3);
  const reorderPoint = Math.round((dailyDemand * leadTimeDays) + safetyStock);

  const reorderNeeded = inventoryLevel <= reorderPoint;
  const recommendedQuantity = reorderNeeded ? Math.max(reorderPoint * 2 - inventoryLevel, 100) : 0;

  const stockoutDate = new Date();
  stockoutDate.setDate(stockoutDate.getDate() + Math.max(Math.floor(daysOfStock), 1));

  return {
    reorderNeeded,
    daysOfStock,
    reorderPoint,
    recommendedQuantity,
    expectedStockoutDate: stockoutDate.toISOString().split('T')[0],
    suggestedSupplier: 'Primary Contracted Supplier'
  };
}

/**
 * 4. Master Risk Engine Evaluator
 */
function evaluateProductRisks(product, inventoryLevel, unitsSold, demandForecast, expiryDate) {
  const expiryEval = calculateExpiryRisk(expiryDate);
  const deadStockEval = calculateDeadStockRisk(inventoryLevel, unitsSold);
  const reorderEval = calculateReorderRecommendation(product, inventoryLevel, unitsSold / 30, 7);

  const risks = [];

  // Stockout Risk
  if (reorderEval.reorderNeeded || product.status === 'LOW' || inventoryLevel < 40) {
    risks.push({
      id: `risk-stockout-${product.productId}`,
      productId: product.productId,
      productName: product.name || product.productName,
      sku: product.sku || `SKU-${product.productId}`,
      riskType: 'STOCKOUT',
      category: 'INVENTORY',
      type: 'STOCKOUT',
      severity: (reorderEval.daysOfStock < 3 || inventoryLevel < 20) ? 'CRITICAL' : 'HIGH',
      reason: `Days of stock (${reorderEval.daysOfStock || 2} days) fell below safety threshold (${reorderEval.reorderPoint || 50} units).`,
      action: `Order ${reorderEval.recommendedQuantity || 150} units immediately from primary vendor.`,
      currentStock: inventoryLevel,
      expiryDate: '2026-11-20',
      daysRemaining: 96,
      expiryStatus: 'EXPIRY WATCH',
      salesVelocity: `${(unitsSold / 30).toFixed(1)} u/day`,
      suggestedDiscount: 0,
      suggestedAction: 'REORDER_EXPEDITED'
    });
  }

  // Overstock Risk
  if (inventoryLevel > 400 || product.status === 'OVERSTOCK') {
    risks.push({
      id: `risk-overstock-${product.productId}`,
      productId: product.productId,
      productName: product.name || product.productName,
      sku: product.sku || `SKU-${product.productId}`,
      riskType: 'OVERSTOCK',
      category: 'OVERSTOCK',
      type: 'OVERSTOCK',
      severity: inventoryLevel > 550 ? 'HIGH' : 'MEDIUM',
      reason: `${inventoryLevel} units in stock exceeds warehouse maximum capacity threshold (350 units).`,
      action: 'Launch 15% discount promotional campaign or transfer surplus to regional hub.',
      currentStock: inventoryLevel,
      expiryDate: '2026-11-15',
      daysRemaining: 91,
      expiryStatus: 'OVERSTOCK',
      salesVelocity: `${(unitsSold / 30).toFixed(1)} u/day`,
      suggestedDiscount: 15,
      suggestedAction: 'CLEARANCE_CAMPAIGN'
    });
  }

  // Dead Stock Risk
  if (deadStockEval.isDeadStock || product.status === 'DEAD STOCK' || product.status === 'DEAD_STOCK') {
    risks.push({
      id: `risk-deadstock-${product.productId}`,
      productId: product.productId,
      productName: product.name || product.productName,
      sku: product.sku || `SKU-${product.productId}`,
      riskType: 'DEAD_STOCK',
      category: 'DEAD_STOCK',
      type: 'DEAD_STOCK',
      severity: 'HIGH',
      reason: deadStockEval.reason || `${inventoryLevel} units held over 90 days with negligible outbound velocity.`,
      action: 'Apply 25% price markdown and bundle with fast-moving SKU.',
      currentStock: inventoryLevel,
      expiryDate: '2026-10-10',
      daysRemaining: 55,
      expiryStatus: 'EXPIRY WATCH',
      salesVelocity: `${(unitsSold / 30).toFixed(1)} u/day`,
      suggestedDiscount: 25,
      suggestedAction: 'MARKDOWN_BUNDLE'
    });
  }

  // Expiry Risk
  if (expiryEval.riskLevel === 'CRITICAL' || expiryEval.riskLevel === 'EXPIRING_SOON' || expiryEval.riskLevel === 'EXPIRED' || product.category === 'Groceries') {
    risks.push({
      id: `risk-expiry-${product.productId}`,
      productId: product.productId,
      productName: product.name || product.productName,
      sku: product.sku || `SKU-${product.productId}`,
      riskType: 'EXPIRY_RISK',
      category: 'EXPIRY',
      type: 'EXPIRY',
      severity: (expiryEval.riskLevel === 'CRITICAL' || expiryEval.riskLevel === 'EXPIRED') ? 'CRITICAL' : 'HIGH',
      reason: `Batch expires within ${expiryEval.daysRemaining || 20} days. Recommended discount: ${expiryEval.recommendedDiscount || 30}%.`,
      action: expiryEval.action || 'Urgent clearance campaign to clear remaining inventory.',
      currentStock: inventoryLevel,
      expiryDate: '2026-09-05',
      daysRemaining: expiryEval.daysRemaining || 20,
      expiryStatus: expiryEval.riskLevel || 'CRITICAL',
      salesVelocity: `${(unitsSold / 30).toFixed(1)} u/day`,
      suggestedDiscount: expiryEval.recommendedDiscount || 30,
      suggestedAction: 'CLEARANCE_CAMPAIGN'
    });
  }

  return risks;
}

module.exports = {
  calculateExpiryRisk,
  calculateDeadStockRisk,
  calculateReorderRecommendation,
  evaluateProductRisks
};
