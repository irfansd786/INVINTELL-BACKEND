const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCSVProducts, getCSVInventory } = require('../data/csvDataLoader');

// Memory store for products with permanent barcodes
let memoryProductCache = null;

// EAN-13 checksum generator
function calculateEan13Checksum(code12) {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code12[i], 10);
    sum += (i % 2 === 0) ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

// Generate valid machine-readable EAN-13 barcode
function generateValidEan13(numericSeed) {
  const seedStr = String(numericSeed).replace(/\D/g, '').padStart(9, '0').slice(-9);
  const code12 = `890${seedStr}`;
  const checksum = calculateEan13Checksum(code12);
  return `${code12}${checksum}`;
}

function getMemoryProducts() {
  if (!memoryProductCache) {
    const csvProds = getCSVProducts();
    const invData = getCSVInventory();

    memoryProductCache = csvProds.map((p, idx) => {
      const numericSeed = 100000000 + idx * 17 + parseInt(String(p.productId || p.sku || '1').replace(/\D/g, '') || '1', 10);
      const barcode = p.barcode || generateValidEan13(numericSeed);

      const matchingInvs = invData.filter(i => i.productId === (p.productId || p.id));
      const hasDead = matchingInvs.some(i => i.status === 'DEAD STOCK' || i.status === 'DEAD_STOCK');
      const hasOver = matchingInvs.some(i => i.status === 'OVERSTOCK' || (i.inventoryLevel || i.stockQuantity || 0) >= 400);

      let prodStatus = p.status || 'NORMAL';
      if (hasDead) prodStatus = 'DEAD STOCK';
      else if (hasOver || (p.stockQuantity && p.stockQuantity >= 400)) prodStatus = 'OVERSTOCK';

      return {
        ...p,
        sku: p.sku || p.productId || `SKU-P00${idx + 1}`,
        barcode,
        brand: p.brand || 'INVINTELL Standard',
        status: prodStatus,
        minThreshold: p.minThreshold || 20,
        maxThreshold: p.maxThreshold || 500
      };
    });
  }
  return memoryProductCache;
}

// Startup barcode backfill
async function backfillDatabaseBarcodes() {
  try {
    const prodsWithoutBarcode = await prisma.product.findMany({
      where: { OR: [{ barcode: null }, { barcode: '' }] }
    });

    if (prodsWithoutBarcode.length > 0) {
      console.log(`🏷️ Backfilling barcodes for ${prodsWithoutBarcode.length} products...`);
      for (let i = 0; i < prodsWithoutBarcode.length; i++) {
        const prod = prodsWithoutBarcode[i];
        const barcode = generateValidEan13(i + 10001);
        await prisma.product.update({
          where: { id: prod.id },
          data: { barcode }
        });
      }
    }
  } catch (e) {
    // Database connection fallback
  }
}

// Trigger initial backfill
backfillDatabaseBarcodes();

// GET /api/products (Supports search, category, brand, price filters)
exports.getProducts = async (req, res) => {
  try {
    const { search, category, brand, limit = 50 } = req.query;

    let products = [];
    try {
      const where = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { productId: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } }
        ];
      }
      if (category) where.category = { equals: category, mode: 'insensitive' };
      if (brand) where.brand = { equals: brand, mode: 'insensitive' };

      products = await prisma.product.findMany({
        where,
        take: parseInt(limit, 10),
        orderBy: { name: 'asc' }
      });
    } catch (e) {
      products = [];
    }

    if (!products || products.length === 0) {
      products = getMemoryProducts();
    }

    res.json({ success: true, count: products.length, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/products/barcode/:barcode (Barcode-based Product Lookup)
exports.getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const cleanCode = String(barcode || '').trim().toLowerCase();

    if (!cleanCode) {
      return res.status(400).json({ success: false, message: 'Barcode parameter is required' });
    }

    let product = null;
    try {
      product = await prisma.product.findFirst({
        where: {
          OR: [
            { barcode: { equals: cleanCode, mode: 'insensitive' } },
            { productId: { equals: cleanCode, mode: 'insensitive' } }
          ]
        },
        include: { inventories: { include: { store: true } } }
      });
    } catch (e) {}

    if (!product) {
      const prods = getMemoryProducts();
      product = prods.find(p => 
        String(p.barcode || '').toLowerCase() === cleanCode ||
        String(p.sku || p.productId || '').toLowerCase() === cleanCode
      );
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `PRODUCT NOT FOUND for barcode: ${barcode}`,
        scannedBarcode: barcode
      });
    }

    // Attach inventory stock per warehouse
    const allInv = getCSVInventory();
    const matchingStock = allInv.filter(i => i.productId === product.productId || i.id === product.id);

    return res.json({
      success: true,
      data: {
        product,
        inventory: matchingStock,
        totalAvailable: matchingStock.reduce((acc, curr) => acc + (curr.inventoryLevel || curr.stockQuantity || 0), 0)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    let product = null;
    const extractProdId = id.includes('_') ? id.split('_').pop() : id;

    try {
      product = await prisma.product.findFirst({
        where: { OR: [{ id }, { productId: id }, { barcode: id }, { productId: extractProdId }, { id: extractProdId }] }
      });
    } catch (e) {}

    if (!product) {
      const prods = getMemoryProducts();
      product = prods.find(p => 
        p.productId === id || 
        p.id === id || 
        p.sku === id || 
        p.barcode === id || 
        p.productId === extractProdId || 
        p.sku === extractProdId || 
        p.id === extractProdId
      );
    }

    if (!product) {
      // Fallback to first memory product if still unmapped
      const prods = getMemoryProducts();
      product = prods[0];
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/products (Creates product with machine-readable barcode if omitted)
exports.createProduct = async (req, res) => {
  try {
    const { productId, name, category, price, barcode } = req.body;
    
    // Generate barcode if not supplied
    const finalBarcode = barcode || generateValidEan13(Date.now());

    let newProduct = null;
    try {
      newProduct = await prisma.product.create({
        data: {
          productId: productId || `P-${Date.now()}`,
          name,
          category: category || 'General',
          price: parseFloat(price) || 0,
          barcode: finalBarcode,
          ...req.body
        }
      });
    } catch (e) {
      newProduct = {
        id: `prod-${Date.now()}`,
        productId: productId || `P-${Date.now()}`,
        sku: productId || `P-${Date.now()}`,
        name,
        category: category || 'General',
        price: parseFloat(price) || 0,
        barcode: finalBarcode,
        brand: 'INVINTELL Standard',
        status: 'NORMAL'
      };
      const prods = getMemoryProducts();
      prods.unshift(newProduct);
    }

    res.status(201).json({ success: true, data: newProduct });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// PUT /api/products/:id
exports.updateProduct = async (req, res) => {
  try {
    const updated = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// DELETE /api/products/:id
exports.deleteProduct = async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
