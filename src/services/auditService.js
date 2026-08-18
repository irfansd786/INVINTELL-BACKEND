const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let memoryAuditLogs = [];

/**
 * Log an immutable audit action to database/memory
 */
async function logAuditAction({ req, action, entityType, entityId, description, warehouseName, metadata = {} }) {
  try {
    const userId = req?.user?.uid || req?.user?.id || 'sys-user-001';
    const userName = req?.user?.name || req?.user?.email?.split('@')[0] || 'System User';
    const userRole = req?.user?.role || 'STAFF';

    const logItem = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      userName,
      userRole,
      action: action || 'SYSTEM_ACTION',
      entityType: entityType || 'GENERAL',
      entityId: entityId || null,
      description: description || 'System operation executed',
      warehouseName: warehouseName || 'Warehouse A (Chicago Hub)',
      metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
      createdAt: new Date().toISOString()
    };

    memoryAuditLogs.unshift(logItem);

    try {
      await prisma.auditLog.create({
        data: {
          userId,
          userName,
          userRole,
          action: action || 'SYSTEM_ACTION',
          entityType: entityType || 'GENERAL',
          entityId: entityId || null,
          description: description || 'System operation executed',
          warehouseName: warehouseName || 'Warehouse A (Chicago Hub)',
          metadata: metadata || {}
        }
      });
    } catch (e) {}

    return logItem;
  } catch (err) {
    console.warn('⚠️ Audit logging failed gracefully:', err.message);
    return null;
  }
}

function getMemoryAuditLogs() {
  return memoryAuditLogs;
}

module.exports = {
  logAuditAction,
  getMemoryAuditLogs
};
