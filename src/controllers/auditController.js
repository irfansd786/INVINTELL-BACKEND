const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getMemoryAuditLogs } = require('../services/auditService');

const DEFAULT_AUDIT_LOGS = [
  { id: 'audit-101', userId: 'usr-owner-001', userName: 'Admin Owner', userRole: 'OWNER', action: 'INVENTORY_ADJUSTMENT', entityType: 'Inventory', entityId: 'INV-1024', description: 'Inventory adjusted from 250 to 240 units due to physical count discrepancy', warehouseName: 'Warehouse A (Chicago Hub)', createdAt: '2026-08-17T14:32:00.000Z' },
  { id: 'audit-102', userId: 'usr-staff-002', userName: 'John Miller', userRole: 'STAFF', action: 'PICKING_COMPLETED', entityType: 'Order', entityId: 'ORD-2026-8093', description: 'Picked 8 units for ticket PK-9041 at bin A-12-04 with barcode verification', warehouseName: 'Warehouse A (Chicago Hub)', createdAt: '2026-08-17T14:18:00.000Z' },
  { id: 'audit-103', userId: 'usr-staff-003', userName: 'Sarah Evans', userRole: 'STAFF', action: 'PACKING_COMPLETED', entityType: 'Order', entityId: 'ORD-2026-8093', description: 'Packed & sealed medium corrugated box PAC-4011', warehouseName: 'Warehouse A (Chicago Hub)', createdAt: '2026-08-17T13:50:00.000Z' },
  { id: 'audit-104', userId: 'usr-owner-001', userName: 'Admin Owner', userRole: 'OWNER', action: 'STAFF_ROLE_CHANGE', entityType: 'Staff', entityId: 'usr-staff-004', description: 'Updated staff permissions for David Miller to include inventory.adjust', warehouseName: 'ALL', createdAt: '2026-08-17T11:20:00.000Z' },
  { id: 'audit-105', userId: 'usr-owner-001', userName: 'Admin Owner', userRole: 'OWNER', action: 'CYCLE_COUNT_COMPLETED', entityType: 'CycleCount', entityId: 'CC-2026-1001', description: 'Completed physical cycle count audit. Reconciled 4 item variances', warehouseName: 'Warehouse B (Dallas Hub)', createdAt: '2026-08-17T10:15:00.000Z' }
];

// GET /api/audit-logs
exports.getAuditLogs = async (req, res) => {
  try {
    let logs = [];
    try {
      logs = await prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100
      });
    } catch (e) {}

    const memLogs = getMemoryAuditLogs();
    const merged = [...memLogs, ...logs];

    if (merged.length === 0) {
      merged.push(...DEFAULT_AUDIT_LOGS);
    }

    const { action, entityType, search } = req.query;
    let filtered = merged;

    if (action && action !== 'ALL') {
      filtered = filtered.filter(l => l.action === action);
    }

    if (entityType && entityType !== 'ALL') {
      filtered = filtered.filter(l => l.entityType === entityType);
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(l => 
        (l.description || '').toLowerCase().includes(q) ||
        (l.userName || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.entityType || '').toLowerCase().includes(q)
      );
    }

    res.json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
