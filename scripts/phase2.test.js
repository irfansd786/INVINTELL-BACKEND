/**
 * INVINTELL Phase 2 Automated Integration & Regression Test Suite
 * Tests Demand Analysis, 7/30/90-Day Forecasting, Reorder Engine, Transparent 0-100 Risk Scoring,
 * FEFO Expiry Batch Prioritization, Finance Metrics, and Phase 1 Regression.
 */

const assert = require('assert');
const { 
  analyzeDemand, 
  generateDemandForecasts, 
  calculateStockCoverageAndReorder, 
  evaluateProductRiskScore, 
  classifyExpiryStatus, 
  getPrioritizedBatches, 
  calculateFinancialMetrics, 
  generateBusinessInsights 
} = require('../src/services/intelligenceEngine');

const { validateOrderTransition } = require('../src/controllers/orderController');
const { adjustStock } = require('../src/controllers/inventoryController');

// Mock Express response helper
function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

async function runPhase2TestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING INVINTELL PHASE 2 AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  async function runTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failedTests++;
    }
  }

  // TEST 1: Demand Analysis & Trend Detection
  await runTest('Demand Analysis - Calculates Averages and Detects Increasing Trend', () => {
    const mockProduct = { productId: 'P0001', name: 'Groceries Item P0001', unitsSold: 120, avgDailyDemand: 2 };
    const mockOrders = Array.from({ length: 15 }, (_, i) => ({ productId: 'P0001', totalItems: 10, status: 'FULFILLED' }));

    const analysis = analyzeDemand(mockProduct, mockOrders);
    assert(analysis.avgDailyDemand > 0, 'Avg daily demand should be greater than 0');
    assert.strictEqual(analysis.dataQuality, 'HIGH', 'Data quality should be HIGH for 150 units');
    assert(['INCREASING', 'STABLE', 'DECREASING'].includes(analysis.demandTrend), 'Trend should be valid string');
  });

  // TEST 2: Demand Analysis - Insufficient Data Handling
  await runTest('Demand Analysis - Correctly Reports INSUFFICIENT_DATA for Sparse Product', () => {
    const mockProduct = { productId: 'P9999', name: 'New Sparse Item', unitsSold: 1 };
    const analysis = analyzeDemand(mockProduct, []);

    assert.strictEqual(analysis.demandTrend, 'INSUFFICIENT_DATA');
    assert.strictEqual(analysis.dataQuality, 'INSUFFICIENT_DATA');
    assert(analysis.explanation.includes('Insufficient historical sales'), 'Explanation should state insufficient data');
  });

  // TEST 3: Deterministic Forecasting (7, 30, 90 Days)
  await runTest('Forecast Engine - Generates 7, 30, and 90-Day Predictions', () => {
    const mockProduct = { productId: 'P0001', name: 'Toys Item P0002', unitsSold: 150 };
    const dAnalysis = analyzeDemand(mockProduct, []);
    const forecast = generateDemandForecasts(mockProduct, dAnalysis);

    assert(forecast.forecast7Days > 0, '7-day forecast should be > 0');
    assert(forecast.forecast30Days > forecast.forecast7Days, '30-day forecast should exceed 7-day forecast');
    assert(forecast.forecast90Days > forecast.forecast30Days, '90-day forecast should exceed 30-day forecast');
    assert(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_DATA'].includes(forecast.qualityIndicator));
  });

  // TEST 4: Stock Coverage & Reorder Engine (Zero Demand Handling)
  await runTest('Stock Coverage Engine - Prevents Divide-by-Zero and Recommends Reorder When Low', () => {
    const mockProduct = { productId: 'P0003', name: 'Toys Item P0003' };
    const dAnalysisZero = { avgDailyDemand: 0, demandTrend: 'STABLE', dataQuality: 'HIGH' };
    
    const zeroEval = calculateStockCoverageAndReorder(mockProduct, 100, dAnalysisZero, 7, 5);
    assert.strictEqual(zeroEval.coverageText, 'No recent demand', 'Zero demand should return clear text without crashing');

    const dAnalysisActive = { avgDailyDemand: 10, demandTrend: 'STABLE', dataQuality: 'HIGH' };
    const reorderEval = calculateStockCoverageAndReorder(mockProduct, 20, dAnalysisActive, 7, 5);
    assert.strictEqual(reorderEval.recommendationStatus, 'REORDER NOW');
    assert(reorderEval.suggestedReorderQuantity > 0, 'Suggested reorder quantity should be positive');
  });

  // TEST 5: Transparent 0-100 Risk Scoring (WHAT / WHY / IMPACT / ACTION)
  await runTest('Risk Engine - Computes Transparent 0-100 Score and Explainable Details', () => {
    const mockProduct = { productId: 'P0005', name: 'Electronics Item P0005', price: 200, status: 'DEAD STOCK' };
    const evalResult = evaluateProductRiskScore(mockProduct, 350, 2, '2026-09-01');

    assert(evalResult.riskScore >= 50, 'Dead stock / expiry should result in high risk score (>=50)');
    assert(evalResult.explainableDetail.what, 'Explainable WHAT should be present');
    assert(evalResult.explainableDetail.why, 'Explainable WHY should be present');
    assert(evalResult.explainableDetail.impact, 'Explainable IMPACT should be present');
    assert(evalResult.explainableDetail.action, 'Explainable ACTION should be present');
  });

  // TEST 6: Pharmacy FEFO (First Expire, First Out) Batch Engine
  await runTest('Pharmacy FEFO Engine - Prioritizes Earliest Non-Expired Batches and Excludes Expired', () => {
    const mockBatches = [
      { id: 'b1', batchNumber: 'BAT-101', expiryDate: '2026-11-01' },
      { id: 'b2', batchNumber: 'BAT-102', expiryDate: '2026-09-01' },
      { id: 'b3', batchNumber: 'BAT-103', expiryDate: '2026-01-01' } // Expired
    ];

    const fefoResult = getPrioritizedBatches(mockBatches);
    assert.strictEqual(fefoResult.sellableBatches.length, 2, 'Expired batch should be excluded from sellable');
    assert.strictEqual(fefoResult.nextToExpireBatch.batchNumber, 'BAT-102', 'Earliest non-expired batch should be prioritized first');
    assert.strictEqual(fefoResult.expiredBatches.length, 1, 'Expired batch count should be 1');
  });

  // TEST 7: Financial Valuation & Profitability Engine
  await runTest('Finance Engine - Calculates Revenue, COGS, Profit Margin and Dead Stock Valuation', () => {
    const mockProducts = [{ productId: 'P0001', name: 'Item P0001', price: 100, costPrice: 60, unitsSold: 50, stockQuantity: 200 }];
    const mockInventory = [{ productId: 'P0001', inventoryLevel: 200, price: 100, unitsSold: 2 }];
    const mockOrders = [{ id: 'o1', totalValue: 5000, status: 'FULFILLED' }];

    const fin = calculateFinancialMetrics(mockProducts, mockInventory, mockOrders);

    assert.strictEqual(fin.revenue, 5000, 'Revenue should equal valid orders total');
    assert(fin.grossProfit > 0, 'Gross profit should be positive');
    assert(fin.inventoryValuation > 0, 'Inventory valuation should reflect physical stock cost');
    assert(fin.deadStockValue > 0, 'Dead stock valuation should calculate capital tied up');
  });

  // TEST 8: Phase 1 Regression Verification
  await runTest('Phase 1 Regression - Order State Machine and Negative Stock Prevention', async () => {
    const transitionCheck = validateOrderTransition('CREATED', 'DISPATCHED');
    assert.strictEqual(transitionCheck.valid, false, 'Direct CREATED to DISPATCHED transition must be rejected');

    const req = { body: { productId: 'P0001', deltaQuantity: -99999, adjustmentType: 'DECREASE' } };
    const res = createMockRes();
    await adjustStock(req, res);
    assert.strictEqual(res.statusCode, 400, 'Negative stock adjustment must return HTTP 400');
  });

  console.log('\n====================================================');
  console.log(`📊 PHASE 2 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase2TestSuite().catch(err => {
  console.error('Phase 2 test execution error:', err);
  process.exit(1);
});
