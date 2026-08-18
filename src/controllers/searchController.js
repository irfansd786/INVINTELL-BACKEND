const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCSVProducts, getCSVOrders, getCSVStores, getCSVInventory } = require('../data/csvDataLoader');

// GET /api/search?q=...
exports.globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const query = String(q || '').trim();

    if (!query) {
      return res.json({
        success: true,
        query: '',
        results: { products: [], orders: [], warehouses: [], inventory: [], suppliers: [] }
      });
    }

    const lowerQ = query.toLowerCase();

    // 1. PRODUCTS SEARCH
    let matchedProducts = [];
    try {
      matchedProducts = await prisma.product.findMany({
        where: {
          OR: [
            { barcode: { equals: query, mode: 'insensitive' } },
            { productId: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
            { brand: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 10
      });
    } catch (e) {
      const csvProds = getCSVProducts();
      matchedProducts = csvProds.filter(p => {
        const pName = String(p.name || p.productName || '').toLowerCase();
        const pSku = String(p.sku || p.productId || '').toLowerCase();
        const pBarcode = String(p.barcode || '').toLowerCase();
        const pCat = String(p.category || '').toLowerCase();
        return pBarcode === lowerQ || pSku === lowerQ || pName.includes(lowerQ) || pSku.includes(lowerQ) || pCat.includes(lowerQ) || pBarcode.includes(lowerQ);
      }).slice(0, 10);
    }

    // Prioritize exact barcode / SKU match to the top
    matchedProducts.sort((a, b) => {
      const aBarcode = String(a.barcode || '').toLowerCase();
      const aSku = String(a.sku || a.productId || '').toLowerCase();
      const bBarcode = String(b.barcode || '').toLowerCase();
      const bSku = String(b.sku || b.productId || '').toLowerCase();

      if (aBarcode === lowerQ || aSku === lowerQ) return -1;
      if (bBarcode === lowerQ || bSku === lowerQ) return 1;
      return 0;
    });

    // 2. ORDERS SEARCH
    let matchedOrders = [];
    try {
      matchedOrders = await prisma.order.findMany({
        where: {
          OR: [
            { orderNumber: { contains: query, mode: 'insensitive' } },
            { customerName: { contains: query, mode: 'insensitive' } },
            { status: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 8
      });
    } catch (e) {
      const csvOrders = getCSVOrders();
      matchedOrders = csvOrders.filter(o => {
        const oNum = String(o.orderNumber || o.id || '').toLowerCase();
        const oCust = String(o.customerName || '').toLowerCase();
        const oProd = String(o.productName || '').toLowerCase();
        return oNum === lowerQ || oNum.includes(lowerQ) || oCust.includes(lowerQ) || oProd.includes(lowerQ);
      }).slice(0, 8);
    }

    // 3. WAREHOUSES SEARCH
    let matchedWarehouses = [];
    try {
      matchedWarehouses = await prisma.store.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { storeCode: { contains: query, mode: 'insensitive' } },
            { region: { contains: query, mode: 'insensitive' } }
          ]
        },
        take: 5
      });
    } catch (e) {
      const csvStores = getCSVStores();
      matchedWarehouses = csvStores.filter(s => {
        const sName = String(s.name || '').toLowerCase();
        const sCode = String(s.storeId || s.storeCode || '').toLowerCase();
        const sReg = String(s.region || '').toLowerCase();
        return sName.includes(lowerQ) || sCode.includes(lowerQ) || sReg.includes(lowerQ);
      }).slice(0, 5);
    }

    // 4. INVENTORY RECORDS SEARCH
    let matchedInventory = [];
    try {
      matchedInventory = await prisma.inventoryRecord.findMany({
        where: {
          OR: [
            { product: { name: { contains: query, mode: 'insensitive' } } },
            { product: { productId: { contains: query, mode: 'insensitive' } } },
            { product: { barcode: { equals: query, mode: 'insensitive' } } },
            { store: { name: { contains: query, mode: 'insensitive' } } }
          ]
        },
        include: { product: true, store: true },
        take: 10
      });
    } catch (e) {
      const csvInv = getCSVInventory();
      matchedInventory = csvInv.filter(i => {
        const pName = String(i.productName || '').toLowerCase();
        const sku = String(i.sku || '').toLowerCase();
        const whName = String(i.warehouseName || '').toLowerCase();
        return pName.includes(lowerQ) || sku.includes(lowerQ) || whName.includes(lowerQ);
      }).slice(0, 10);
    }

    // 5. SUPPLIERS SEARCH
    const suppliersData = [
      { supplierId: 'SUP-001', name: 'Global Apex Logistics & Supply', contact: 'Mark Vance', email: 'supply@globalapex.com' },
      { supplierId: 'SUP-002', name: 'Nexus Component Tech', contact: 'Elena Rostova', email: 'orders@nexuscomp.io' },
      { supplierId: 'SUP-003', name: 'Pacific Rim Goods Co.', contact: 'Kenji Sato', email: 'b2b@pacificrim.jp' }
    ];
    const matchedSuppliers = suppliersData.filter(sup => 
      sup.name.toLowerCase().includes(lowerQ) || 
      sup.supplierId.toLowerCase().includes(lowerQ) || 
      sup.contact.toLowerCase().includes(lowerQ)
    );

    return res.json({
      success: true,
      query,
      results: {
        products: matchedProducts,
        orders: matchedOrders,
        warehouses: matchedWarehouses,
        inventory: matchedInventory,
        suppliers: matchedSuppliers
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
