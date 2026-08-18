/**
 * INVINTELL Operational Synthetic Data Generator
 * Populates relational synthetic operational data referencing real CSV Products and Warehouses.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedSyntheticData() {
  console.log('🚀 Generating Relational Synthetic Operational Dataset for INVINTELL...');

  try {
    // 1. Fetch Real Products & Warehouses
    let products = [];
    let stores = [];

    try {
      products = await prisma.product.findMany();
      stores = await prisma.store.findMany();
    } catch (e) {
      console.warn('⚠️ PostgreSQL unavailable for Prisma queries, skipping DB write.');
      return;
    }

    if (products.length === 0 || stores.length === 0) {
      console.log('⚠️ Database has no Products or Stores yet. Run importData.js first.');
      return;
    }

    console.log(`📦 Found ${products.length} Products & ${stores.length} Warehouses in DB.`);

    // 2. Seed Suppliers
    console.log('🏭 Seeding Suppliers...');
    const suppliersData = [
      { supplierId: 'SUP-001', supplierName: 'Global Apex Logistics & Supply', contact: 'Mark Vance', email: 'supply@globalapex.com', location: 'Chicago, IL', reliabilityScore: 98.5 },
      { supplierId: 'SUP-002', supplierName: 'Nexus Component Tech', contact: 'Elena Rostova', email: 'orders@nexuscomp.io', location: 'Dallas, TX', reliabilityScore: 96.2 },
      { supplierId: 'SUP-003', supplierName: 'Pacific Rim Goods Co.', contact: 'Kenji Sato', email: 'b2b@pacificrim.jp', location: 'Los Angeles, CA', reliabilityScore: 99.1 },
      { supplierId: 'SUP-004', supplierName: 'Vanguard Industrial Wholesale', contact: 'Sarah Jenkins', email: 'fulfillment@vanguard.com', location: 'Atlanta, GA', reliabilityScore: 95.8 },
      { supplierId: 'SUP-005', supplierName: 'Horizon Electronics Ltd.', contact: 'David Kim', email: 'sales@horizonelec.kr', location: 'Seattle, WA', reliabilityScore: 97.4 },
      { supplierId: 'SUP-006', supplierName: 'Sterling Apparel & Textiles', contact: 'Chloe Dupont', email: 'orders@sterlingapparel.fr', location: 'New York, NY', reliabilityScore: 94.9 }
    ];

    const seededSuppliers = [];
    for (const sup of suppliersData) {
      const s = await prisma.supplier.upsert({
        where: { supplierId: sup.supplierId },
        update: sup,
        create: sup
      });
      seededSuppliers.push(s);
    }

    // 3. Seed Supplier-Product Relationships
    console.log('🔗 Seeding SupplierProduct Relationships...');
    for (const prod of products) {
      const primarySup = seededSuppliers[Math.floor(Math.random() * seededSuppliers.length)];
      await prisma.supplierProduct.upsert({
        where: {
          supplierId_productId: {
            supplierId: primarySup.id,
            productId: prod.id
          }
        },
        update: {
          supplierPrice: Math.round(prod.price * 0.6 * 100) / 100,
          leadTimeDays: Math.floor(Math.random() * 10) + 3,
          minimumOrderQuantity: 50
        },
        create: {
          supplierId: primarySup.id,
          productId: prod.id,
          supplierPrice: Math.round(prod.price * 0.6 * 100) / 100,
          leadTimeDays: Math.floor(Math.random() * 10) + 3,
          minimumOrderQuantity: 50
        }
      });
    }

    // 4. Seed Product Batches (Expiry Management)
    console.log('🏷️ Seeding Product Batches & Expiry Dates...');
    const now = new Date();
    for (let i = 0; i < products.length; i++) {
      const prod = products[i];
      const store = stores[i % stores.length];

      // Expiry dates: some safe, some watch (45 days), some critical (18 days)
      let daysToAdd = 120;
      if (i % 5 === 0) daysToAdd = 18;  // CRITICAL
      else if (i % 5 === 1) daysToAdd = 45; // WATCH

      const expiry = new Date();
      expiry.setDate(now.getDate() + daysToAdd);

      const mfg = new Date();
      mfg.setDate(now.getDate() - 90);

      await prisma.productBatch.upsert({
        where: { batchId: `BATCH-2026-${1000 + i}` },
        update: {
          productId: prod.id,
          storeId: store.id,
          batchNumber: `BN-902-${100 + i}`,
          manufacturingDate: mfg,
          expiryDate: expiry,
          quantity: 200,
          remainingQuantity: Math.floor(Math.random() * 150) + 20
        },
        create: {
          batchId: `BATCH-2026-${1000 + i}`,
          productId: prod.id,
          storeId: store.id,
          batchNumber: `BN-902-${100 + i}`,
          manufacturingDate: mfg,
          expiryDate: expiry,
          quantity: 200,
          remainingQuantity: Math.floor(Math.random() * 150) + 20
        }
      });
    }

    // 5. Seed Customers
    console.log('👥 Seeding Enterprise B2B Customers...');
    const customersData = [
      { customerId: 'CUST-1001', customerName: 'AeroTech Systems Inc', customerType: 'DISTRIBUTOR', location: 'Chicago, IL', contact: 'James Wilson' },
      { customerId: 'CUST-1002', customerName: 'FluidDynamics Corp', customerType: 'WHOLESALER', location: 'Dallas, TX', contact: 'Amanda Miller' },
      { customerId: 'CUST-1003', customerName: 'Precision Controls Ltd', customerType: 'RETAILER', location: 'Los Angeles, CA', contact: 'Robert Chen' },
      { customerId: 'CUST-1004', customerName: 'VibraSens Solutions', customerType: 'BUSINESS', location: 'Denver, CO', contact: 'Emily Zhang' },
      { customerId: 'CUST-1005', customerName: 'OmniCorp Global Supply', customerType: 'DISTRIBUTOR', location: 'Miami, FL', contact: 'Carlos Rodriguez' }
    ];

    const seededCustomers = [];
    for (const cust of customersData) {
      const c = await prisma.customer.upsert({
        where: { customerId: cust.customerId },
        update: cust,
        create: cust
      });
      seededCustomers.push(c);
    }

    console.log('✅ Operational Synthetic Data Seeded Successfully!');
  } catch (err) {
    console.error('❌ Synthetic Seeding Error:', err.message);
  }
}

seedSyntheticData()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
