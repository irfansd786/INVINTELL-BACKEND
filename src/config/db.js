const { PrismaClient } = require('@prisma/client');

// Quiet PrismaClient instance for smooth local/fallback operation
const prisma = new PrismaClient({
  log: ['warn']
});

module.exports = prisma;
