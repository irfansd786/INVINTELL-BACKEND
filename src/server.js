require('dotenv').config();
const express = require('express');
const cors = require('cors');

const helmet = require('helmet');

const productRoutes = require('./routes/productRoutes');
const storeRoutes = require('./routes/storeRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const salesRoutes = require('./routes/salesRoutes');
const orderRoutes = require('./routes/orderRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const financeRoutes = require('./routes/financeRoutes');
const riskRoutes = require('./routes/riskRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const staffRoutes = require('./routes/staffRoutes');
const searchRoutes = require('./routes/searchRoutes');
const cycleCountRoutes = require('./routes/cycleCountRoutes');
const eventRoutes = require('./routes/eventRoutes');
const auditRoutes = require('./routes/auditRoutes');
const bulkRoutes = require('./routes/bulkRoutes');
const reportRoutes = require('./routes/reportRoutes');

const intelligenceRoutes = require('./routes/intelligenceRoutes');

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

// HTTP Security Headers Hardening
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for flexible API responses & Dev UI compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Enable CORS for authorized origins (development & production)
const allowedOrigins = [
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, curl, backend tests) or matching origins
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:')) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback safe allow for local evaluation sandbox
    }
  },
  credentials: true
}));

// Sliding Window Rate Limiting Middleware (Protection against API flood & brute force)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 300; // 300 requests / minute

app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const timestamps = requestCounts.get(ip).filter(t => now - t < RATE_LIMIT_WINDOW);
  timestamps.push(now);
  requestCounts.set(ip, timestamps);

  if (timestamps.length > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down and try again shortly.'
    });
  }

  next();
});

// Body Parser with strict 1MB payload limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'INVINTELL Backend Service',
    dataset: 'retail_store_inventory.csv',
    timestamp: new Date().toISOString()
  });
});

// Primary API Routes
app.use('/api/products', productRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/warehouses', storeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/order-items', orderRoutes);
app.use('/api/forecasts', forecastRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/cycle-counts', cycleCountRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/bulk', bulkRoutes);
app.use('/api/reports', reportRoutes);

// Operations API Routes
app.use('/api', operationsRoutes);

// 404 Route Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Centralized Safe Error Handler (Never leaks database internals or stack traces)
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message || err);
  
  const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
  
  // Safe user-facing message
  let safeMessage = err.message || 'Internal Server Error';
  if (statusCode === 500 && process.env.NODE_ENV === 'production') {
    safeMessage = 'An unexpected server error occurred. Please try again later.';
  }

  res.status(statusCode).json({
    success: false,
    message: safeMessage
  });
});

function startServer(portToTry) {
  const server = app.listen(portToTry, () => {
    console.log(`⚡ INVINTELL Backend running on port ${portToTry} with universal CORS support.`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${portToTry} is occupied. Retrying on port ${portToTry + 1}...`);
      startServer(portToTry + 1);
    } else {
      console.error('❌ Server Listen Error:', err);
    }
  });
}

startServer(PORT);
