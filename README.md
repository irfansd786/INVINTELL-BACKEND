# INVINTELL Backend — Inventory & Warehouse Intelligence API Service

[![Build Status](https://img.shields.io/badge/Build-PASSING-success)](https://github.com/)
[![License](https://img.shields.io/badge/License-MIT-blue)](https://opensource.org/licenses/MIT)

**INVINTELL Backend** is a Node.js + Express API service powering multi-warehouse order fulfillment state machines, statistical demand forecasting engines, FEFO (First Expire, First Out) batch management, and financial valuation metrics.

---

## Capabilities & Tech Stack

- **Core**: Node.js, Express, Prisma ORM
- **Dataset**: Real retail store inventory CSV engine with resilient in-memory fallback store
- **Security Hardening**: Express `helmet` headers, 300 req/min sliding-window rate limiting, 1MB request body limits, sanitized error responses
- **Caching**: High-performance in-memory caching service (`cacheService.js`) for high-frequency analytics and forecast endpoints
- **Testing**: Master E2E integration test suite (`scripts/phase3.test.js`) verifying state machine lockouts, stock boundary safety, and financial margin calculations

---

## Quick Start

```bash
# Install dependencies
npm install

# Start backend server on port 5000
npm start

# Run automated backend master integration test suite
npm test
```

---

## Repository Links

- **Backend Repository**: [irfansd786/INVINTELL-BACKEND](https://github.com/irfansd786/INVINTELL-BACKEND)
- **Frontend Repository**: [irfansd786/INVINTELL-FRONTEND](https://github.com/irfansd786/INVINTELL-FRONTEND)
