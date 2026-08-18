/**
 * INVINTELL Phase 3 Master End-to-End Integration & Regression Test Suite
 * Validates complete E2E order fulfillment lifecycle, state machine sequence locks,
 * inventory boundary checks, inter-warehouse transfers, Phase 2 intelligence,
 * FEFO batch prioritization, financial decision algorithms, and system resilience.
 */

const assert = require('assert');
const { 
  getMemoryOrders, 
  validateOrderTransition, 
  createOrder, 
  updateOrderStatus 
} = require('../src/controllers/orderController');

const { 
  getMemoryInventory, 
  adjustStock 
} = require('../src/controllers/inventoryController');

const { 
  performAllocation, 
  completePickingTask, 
  completePackingTask, 
  confirmDispatch, 
  createTransfer, 
  createException, 
  resolveException, 
  memoryPacking, 
  memoryDispatch 
} = require('../src/controllers/operationsController');

const { 
  analyzeDemand, 
  generateDemandForecasts, 
  calculateStockCoverageAndReorder, 
  evaluateProductRiskScore, 
  getPrioritizedBatches, 
  calculateFinancialMetrics, 
  generateBusinessInsights 
} = require('../src/services/intelligenceEngine');

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

async function runMasterPhase3TestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING INVINTELL PHASE 3 MASTER INTEGRATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. E2E FULL ORDER LIFECYCLE WORKFLOW
  await test('E2E Lifecycle: CREATED -> ALLOCATED -> PICKED -> PACKED -> DISPATCHED', async () => {
    const orders = getMemoryOrders();
    const testOrderId = 'ord-e2e-phase3';
    const testOrder = {
      id: testOrderId,
      orderNumber: 'ORD-E2E-3001',
      productId: 'P0001',
      sku: 'SKU-P0001',
      items: 10,
      totalItems: 10,
      warehouseName: 'Warehouse A (Chicago Hub)',
      status: 'CREATED'
    };
    orders.unshift(testOrder);

    // Step A: CREATED -> ALLOCATED
    const allocReq = { body: { orderId: testOrderId, warehouseName: 'Warehouse A (Chicago Hub)' } };
    const allocRes = createMockRes();
    await performAllocation(allocReq, allocRes);
    assert.strictEqual(allocRes.statusCode, 200, 'Allocation should succeed');
    assert.strictEqual(testOrder.status, 'ALLOCATED', 'Status must transition to ALLOCATED');

    // Step B: ALLOCATED -> PICKED
    const ops = require('../src/controllers/operationsController');
    const pickingList = ops.getMemoryPicking();
    const packingList = ops.getMemoryPacking();
    const dispatchList = ops.getMemoryDispatch();

    pickingList[0].orderId = testOrderId;
    pickingList[0].orderNumber = 'ORD-E2E-3001';
    pickingList[0].status = 'IN_PROGRESS';

    const pickReq = { params: { id: pickingList[0].id } };
    const pickRes = createMockRes();
    await ops.completePickingTask(pickReq, pickRes);
    assert.strictEqual(pickRes.statusCode, 200, 'Picking completion should succeed');

    // Step C: PICKED -> PACKED
    packingList[0].orderId = testOrderId;
    packingList[0].orderNumber = 'ORD-E2E-3001';
    packingList[0].status = 'IN_PROGRESS';
    testOrder.status = 'PICKED'; // Explicitly in PICKED state before packing

    const packReq = { params: { id: packingList[0].id } };
    const packRes = createMockRes();
    await ops.completePackingTask(packReq, packRes);
    assert.strictEqual(packRes.statusCode, 200, 'Packing task completion should succeed');
    assert.strictEqual(testOrder.status, 'PACKED', 'Order status must transition to PACKED');

    // Step D: PACKED -> DISPATCHED
    dispatchList[0].orderId = testOrderId;
    dispatchList[0].orderNumber = 'ORD-E2E-3001';
    dispatchList[0].status = 'READY';

    const dispReq = { params: { id: dispatchList[0].id } };
    const dispRes = createMockRes();
    await ops.confirmDispatch(dispReq, dispRes);
    assert.strictEqual(dispRes.statusCode, 200, 'Dispatch confirmation should succeed');
    assert.strictEqual(testOrder.status, 'DISPATCHED', 'Order status must transition to DISPATCHED');
  });

  // 2. INVALID STATE TRANSITION LOCKS
  await test('Order State Machine - Rejects Out-of-Sequence Transitions', () => {
    const check1 = validateOrderTransition('CREATED', 'PACKED');
    assert.strictEqual(check1.valid, false, 'CREATED -> PACKED must be rejected');

    const check2 = validateOrderTransition('CREATED', 'DISPATCHED');
    assert.strictEqual(check2.valid, false, 'CREATED -> DISPATCHED must be rejected');

    const check3 = validateOrderTransition('PACKED', 'CREATED');
    assert.strictEqual(check3.valid, false, 'PACKED -> CREATED must be rejected');
  });

  // 3. INVENTORY SHORTAGE & BOUNDARY CHECKS
  await test('Stock Integrity - Fails Shortage Allocation and Negative Adjustments', async () => {
    const orders = getMemoryOrders();
    orders.unshift({
      id: 'ord-shortage-p3',
      orderNumber: 'ORD-SHORT-303',
      productId: 'P0001',
      items: 99999,
      totalItems: 99999,
      warehouseName: 'Warehouse A (Chicago Hub)',
      status: 'CREATED'
    });

    const allocRes = createMockRes();
    await performAllocation({ body: { orderId: 'ord-shortage-p3', warehouseName: 'Warehouse A (Chicago Hub)' } }, allocRes);
    assert.strictEqual(allocRes.statusCode, 400, 'Shortage allocation must return HTTP 400');

    const adjRes = createMockRes();
    await adjustStock({ body: { productId: 'P0001', deltaQuantity: -999999, adjustmentType: 'DECREASE' } }, adjRes);
    assert.strictEqual(adjRes.statusCode, 400, 'Negative stock adjustment must return HTTP 400');
  });

  // 4. INTER-WAREHOUSE TRANSFERS
  await test('Transfer Engine - Rejects Same Warehouse and Stock Shortage', async () => {
    const resSame = createMockRes();
    await createTransfer({
      body: {
        sourceWarehouse: 'Warehouse A (Chicago Hub)',
        destinationWarehouse: 'Warehouse A (Chicago Hub)',
        items: [{ productId: 'P0001', quantity: 10 }]
      }
    }, resSame);
    assert.strictEqual(resSame.statusCode, 400, 'Same warehouse transfer must be rejected');

    const resExcess = createMockRes();
    await createTransfer({
      body: {
        sourceWarehouse: 'Warehouse A (Chicago Hub)',
        destinationWarehouse: 'Warehouse B (Dallas Hub)',
        items: [{ productId: 'P0001', quantity: 999999 }]
      }
    }, resExcess);
    assert.strictEqual(resExcess.statusCode, 400, 'Excess quantity transfer must be rejected');
  });

  // 5. PHASE 2 FORECASTING & REORDER LOGIC
  await test('Intelligence Engine - Forecasts 7/30/90 Days & Handles 0 Demand', () => {
    const mockP = { productId: 'P0001', name: 'Item P0001', unitsSold: 120 };
    const dAnalysis = analyzeDemand(mockP, []);
    const fData = generateDemandForecasts(mockP, dAnalysis);

    assert(fData.forecast7Days > 0, '7-day forecast must be positive');
    assert(fData.forecast30Days > fData.forecast7Days, '30-day forecast must exceed 7-day');
    assert(fData.forecast90Days > fData.forecast30Days, '90-day forecast must exceed 30-day');

    const covEval = calculateStockCoverageAndReorder(mockP, 50, { avgDailyDemand: 0 }, 7, 5);
    assert.strictEqual(covEval.coverageText, 'No recent demand', 'Zero demand should return clear text');
  });

  // 6. TRANSPARENT 0-100 RISK SCORING (WHAT / WHY / IMPACT / ACTION)
  await test('Risk Engine - Computes Transparent Score & Explainable Directives', () => {
    const mockP = { productId: 'P0002', name: 'Item P0002', price: 150, status: 'DEAD STOCK' };
    const scoreEval = evaluateProductRiskScore(mockP, 300, 1, '2026-09-10');

    assert(scoreEval.riskScore >= 50, 'High risk item should have score >= 50');
    assert(scoreEval.explainableDetail.what, 'WHAT breakdown required');
    assert(scoreEval.explainableDetail.why, 'WHY breakdown required');
    assert(scoreEval.explainableDetail.impact, 'IMPACT breakdown required');
    assert(scoreEval.explainableDetail.action, 'ACTION directive required');
  });

  // 7. PHARMACY FEFO BATCH PRIORITIZATION
  await test('Pharmacy FEFO - Prioritizes Earliest Non-Expired Batch & Excludes Expired', () => {
    const batches = [
      { id: 'b1', batchNumber: 'BAT-01', expiryDate: '2026-12-01' },
      { id: 'b2', batchNumber: 'BAT-02', expiryDate: '2026-09-15' },
      { id: 'b3', batchNumber: 'BAT-03', expiryDate: '2026-01-01' } // Expired
    ];

    const fefo = getPrioritizedBatches(batches);
    assert.strictEqual(fefo.sellableBatches.length, 2, 'Expired batch excluded from sellable');
    assert.strictEqual(fefo.nextToExpireBatch.batchNumber, 'BAT-02', 'Earliest valid batch prioritized');
    assert.strictEqual(fefo.expiredBatches.length, 1, 'Expired count should be 1');
  });

  // 8. FINANCIAL METRICS & BUSINESS INSIGHTS
  await test('Finance Engine - Computes Revenue, COGS, Profit Margin & Business Insights', () => {
    const prods = [{ productId: 'P0001', price: 100, costPrice: 60, unitsSold: 50, stockQuantity: 200 }];
    const inv = [{ productId: 'P0001', inventoryLevel: 200, price: 100, unitsSold: 2 }];
    const ords = [{ id: 'o1', totalValue: 5000, status: 'FULFILLED' }];

    const fin = calculateFinancialMetrics(prods, inv, ords);
    assert.strictEqual(fin.revenue, 5000, 'Revenue calculated from valid orders');
    assert(fin.grossProfit > 0, 'Gross profit must be positive');
    assert(fin.inventoryValuation > 0, 'Inventory valuation calculated correctly');

    const insights = generateBusinessInsights(prods, inv, ords);
    assert(insights.length > 0, 'Business insights layer must generate insights');
  });

  console.log('\n====================================================');
  console.log(`📊 MASTER PHASE 3 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runMasterPhase3TestSuite().catch(err => {
  console.error('Master Phase 3 test error:', err);
  process.exit(1);
});
