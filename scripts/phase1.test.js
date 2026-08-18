/**
 * INVINTELL Phase 1 Automated Integration & Regression Test Suite
 * Tests Inventory Engine, Order State Machine, Allocation, Picking, Packing, Dispatch, Transfers, and Exceptions.
 */

const assert = require('assert');
const { adjustStock } = require('../src/controllers/inventoryController');
const { getMemoryOrders, validateOrderTransition } = require('../src/controllers/orderController');
const { performAllocation, completePickingTask, completePackingTask, confirmDispatch, createTransfer, createException, resolveException } = require('../src/controllers/operationsController');

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

async function runPhase1TestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING INVINTELL PHASE 1 AUTOMATED TEST SUITE');
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

  // TEST 1: Inventory Stock Adjustment & Negative Stock Prevention
  await runTest('Inventory Engine - Rejects Negative Stock Adjustments', async () => {
    const req = {
      body: {
        productId: 'P0001',
        adjustmentQuantity: -99999,
        adjustmentType: 'DECREASE',
        reason: 'Test Excessive Decrease'
      }
    };
    const res = createMockRes();
    await adjustStock(req, res);

    assert.strictEqual(res.statusCode, 400, 'Should return HTTP 400 for negative stock result');
    assert.strictEqual(res.body.success, false, 'Response success should be false');
    assert(res.body.message.includes('negative'), 'Message should indicate stock cannot become negative');
  });

  // TEST 2: Order State Machine - Valid Transition
  await runTest('Order State Machine - Allows CREATED -> ALLOCATED', () => {
    const check = validateOrderTransition('CREATED', 'ALLOCATED');
    assert.strictEqual(check.valid, true, 'CREATED to ALLOCATED should be valid');
  });

  // TEST 3: Order State Machine - Invalid Transition Rejection
  await runTest('Order State Machine - Rejects Invalid CREATED -> PACKED Transition', () => {
    const check = validateOrderTransition('CREATED', 'PACKED');
    assert.strictEqual(check.valid, false, 'CREATED to PACKED must be rejected');
    assert(check.message.includes('Invalid order state transition'), 'ErrorMessage should cite invalid state transition');
  });

  // TEST 4: Allocation Engine - Stock Shortage Failure
  await runTest('Allocation Engine - Fails When Stock Quantity Shortage Occurs', async () => {
    const req = {
      body: {
        orderId: 'ord-csv-shortage-test',
        warehouseName: 'Warehouse A (Chicago Hub)'
      }
    };
    const orders = getMemoryOrders();
    orders.unshift({
      id: 'ord-csv-shortage-test',
      orderNumber: 'ORD-SHORTAGE-99',
      productId: 'P0001',
      sku: 'SKU-P0001',
      items: 99999,
      totalItems: 99999,
      warehouseName: 'Warehouse A (Chicago Hub)',
      status: 'CREATED'
    });

    const res = createMockRes();
    await performAllocation(req, res);

    assert.strictEqual(res.statusCode, 400, 'Should return HTTP 400 on shortage');
    assert.strictEqual(res.body.success, false);
    assert(res.body.message.toLowerCase().includes('shortage'), 'Message should report stock shortage');
  });

  // TEST 5: Packing Engine - Rejects Packing Unpicked Orders
  await runTest('Packing Engine - Prevents Packing Orders That Have Not Been Picked', async () => {
    const orders = getMemoryOrders();
    orders.unshift({
      id: 'ord-301',
      orderNumber: 'ORD-2022-9004',
      status: 'CREATED'
    });

    const req = { params: { id: 'pack-301' } };
    const res = createMockRes();
    await completePackingTask(req, res);

    assert.strictEqual(res.statusCode, 400, 'Should return HTTP 400 when attempting to pack unpicked order');
    assert.strictEqual(res.body.success, false);
  });

  // TEST 6: Dispatch Engine - Rejects Dispatching Unpacked Orders
  await runTest('Dispatch Engine - Prevents Dispatching Unpacked Orders', async () => {
    const orders = getMemoryOrders();
    orders.unshift({
      id: 'ord-401',
      orderNumber: 'ORD-2022-9005',
      status: 'ALLOCATED'
    });

    const req = { params: { id: 'disp-401' } };
    const res = createMockRes();
    await confirmDispatch(req, res);

    assert.strictEqual(res.statusCode, 400, 'Should return HTTP 400 when attempting to dispatch unpacked order');
    assert.strictEqual(res.body.success, false);
  });

  // TEST 7: Transfers Engine - Rejects Same Source & Destination Warehouse
  await runTest('Transfer Engine - Rejects Transfers Where Source Equals Destination', async () => {
    const req = {
      body: {
        productName: 'Groceries Item P0001',
        sku: 'SKU-P0001',
        fromWarehouse: 'Warehouse A (Chicago Hub)',
        toWarehouse: 'Warehouse A (Chicago Hub)',
        quantity: 25
      }
    };
    const res = createMockRes();
    await createTransfer(req, res);

    assert.strictEqual(res.statusCode, 400, 'Should return HTTP 400 for identical source and destination');
    assert.strictEqual(res.body.success, false);
    assert(res.body.message.includes('identical'), 'Message should indicate identical warehouses');
  });

  // TEST 8: Exception Engine - Creates and Resolves Exceptions
  await runTest('Exceptions Engine - Successfully Logs and Resolves Operational Exceptions', async () => {
    const createReq = {
      body: {
        title: 'Damaged Packaging Flagged',
        description: 'Outer carton crushed during unloading',
        warehouseName: 'Warehouse B (Dallas Hub)',
        type: 'DAMAGED',
        severity: 'MEDIUM'
      }
    };
    const createRes = createMockRes();
    await createException(createReq, createRes);

    assert.strictEqual(createRes.statusCode, 201);
    assert.strictEqual(createRes.body.success, true);
    const createdId = createRes.body.data.id;

    const resolveReq = { params: { id: createdId } };
    const resolveRes = createMockRes();
    await resolveException(resolveReq, resolveRes);

    assert.strictEqual(resolveRes.statusCode, 200);
    assert.strictEqual(resolveRes.body.data.status, 'RESOLVED');
  });

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runPhase1TestSuite().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
