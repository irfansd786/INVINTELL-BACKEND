// INVINTELL Backend Data Store — Fed Directly from retail_store_inventory.csv
const {
  getCSVProducts,
  getCSVStores,
  getCSVInventory,
  getCSVOrders,
  getCSVRisks,
  getCSVFinanceSummary,
  getCSVWarehousePerformance,
  getCSVRevenueTrend
} = require('./csvDataLoader');

const PRODUCTS = getCSVProducts();
const STORES = getCSVStores();
const INVENTORY = getCSVInventory();
const ORDERS = getCSVOrders();
const RISKS = getCSVRisks();
const FINANCE_SUMMARY = getCSVFinanceSummary();
const WAREHOUSE_SALES_PERFORMANCE = getCSVWarehousePerformance();
const REVENUE_TREND = getCSVRevenueTrend();

module.exports = {
  PRODUCTS,
  STORES,
  INVENTORY,
  ORDERS,
  RISKS,
  FINANCE_SUMMARY,
  PRODUCT_SALES_PERFORMANCE: PRODUCTS,
  REVENUE_TREND,
  WAREHOUSE_SALES_PERFORMANCE
};
