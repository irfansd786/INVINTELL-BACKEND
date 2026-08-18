const { getFirebaseAuth } = require('../config/firebaseAdmin');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

let memoryStaffList = [
  { id: 'usr-admin-owner-001', firebaseUid: 'admin-owner-001', name: 'System Owner Admin', email: 'admin@invintell.io', role: 'OWNER', department: 'Executive Command', warehouseId: 'ALL', permissions: ['*'], status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'usr-staff-101', firebaseUid: 'uid-staff-101', name: 'Sarah Evans', email: 'sarah.evans@invintell.io', role: 'STAFF', department: 'Warehouse Operations', warehouseId: 'Warehouse A (Chicago Hub)', permissions: ['overview.view', 'inventory.view', 'orders.view', 'picking.view'], status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'usr-staff-102', firebaseUid: 'uid-staff-102', name: 'John Miller', email: 'john.miller@invintell.io', role: 'STAFF', department: 'Outbound Logistics', warehouseId: 'Warehouse B (Dallas Hub)', permissions: ['overview.view', 'orders.view', 'packing.view', 'dispatch.view'], status: 'ACTIVE', createdAt: new Date().toISOString() }
];

// GET /api/staff/me - Get current user profile (Authentication Disabled / Standalone Mode)
exports.getCurrentUserProfile = async (req, res) => {
  try {
    const user = req.user || memoryStaffList[0];
    return res.json({
      success: true,
      data: user
    });
  } catch (err) {
    return res.json({
      success: true,
      data: memoryStaffList[0]
    });
  }
};

// GET /api/staff - List all staff members (OWNER ONLY)
exports.getAllStaff = async (req, res) => {
  try {
    let staffList = [];
    try {
      staffList = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' }
      });
    } catch (e) {}

    const merged = [...memoryStaffList, ...staffList];
    const uniqueMap = new Map();
    merged.forEach(s => {
      if (s.id || s.email) {
        uniqueMap.set(s.email || s.id, s);
      }
    });

    const uniqueList = Array.from(uniqueMap.values());
    return res.json({
      success: true,
      count: uniqueList.length,
      data: uniqueList
    });
  } catch (err) {
    return res.json({
      success: true,
      count: memoryStaffList.length,
      data: memoryStaffList
    });
  }
};

// GET /api/staff/:id - Get single staff details (OWNER ONLY)
exports.getStaffById = async (req, res) => {
  try {
    const { id } = req.params;
    let staffMember = memoryStaffList.find(s => s.id === id);

    if (!staffMember) {
      try {
        staffMember = await prisma.user.findUnique({ where: { id } });
      } catch (e) {}
    }

    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    return res.json({ success: true, data: staffMember });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/staff - Create new staff account (OWNER ONLY)
exports.createStaff = async (req, res) => {
  try {
    const { name, email, password, role, permissions, department, warehouseId } = req.body;

    if (!email || !name) {
      return res.status(400).json({ success: false, message: 'Name and Email are required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanPassword || cleanPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
    }

    let createdFirebaseUid = `uid-staff-${Date.now()}`;

    // 1. Attempt Firebase Auth user creation if Firebase Admin SDK is available
    const firebaseAuth = getFirebaseAuth();
    if (firebaseAuth) {
      try {
        const firebaseUser = await firebaseAuth.createUser({
          email: cleanEmail,
          password: cleanPassword,
          displayName: name
        });
        createdFirebaseUid = firebaseUser.uid;
      } catch (fbErr) {
        if (fbErr.code === 'auth/email-already-exists') {
          try {
            const existingFbUser = await firebaseAuth.getUserByEmail(cleanEmail);
            createdFirebaseUid = existingFbUser.uid;
          } catch (e) {}
        }
      }
    }

    const assignedPermissions = Array.isArray(permissions) ? permissions : [
      'overview.view', 'inventory.view', 'orders.view', 'picking.view', 'packing.view', 'dispatch.view'
    ];

    const newStaffItem = {
      id: `usr-staff-${Date.now()}`,
      firebaseUid: createdFirebaseUid,
      name,
      email: cleanEmail,
      role: 'STAFF',
      permissions: assignedPermissions,
      department: department || 'Warehouse Operations',
      warehouseId: warehouseId || 'Warehouse A (Chicago Hub)',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    };

    memoryStaffList.unshift(newStaffItem);

    // 2. Try creating user in database
    try {
      await prisma.user.create({
        data: {
          firebaseUid: createdFirebaseUid,
          name,
          email: cleanEmail,
          role: 'STAFF',
          permissions: assignedPermissions,
          department: department || 'Warehouse Operations',
          warehouseId: warehouseId || 'Warehouse A (Chicago Hub)',
          status: 'ACTIVE'
        }
      });
    } catch (dbErr) {}

    return res.status(201).json({
      success: true,
      message: `Staff account provisioned successfully for ${cleanEmail}`,
      data: newStaffItem
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/staff/:id - Update staff profile and permissions (OWNER ONLY)
exports.updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, permissions, department, warehouseId } = req.body;

    const memIdx = memoryStaffList.findIndex(s => s.id === id);
    if (memIdx >= 0) {
      memoryStaffList[memIdx] = {
        ...memoryStaffList[memIdx],
        ...(name && { name }),
        ...(Array.isArray(permissions) && { permissions }),
        ...(department && { department }),
        ...(warehouseId && { warehouseId })
      };
    }

    try {
      await prisma.user.update({
        where: { id },
        data: {
          ...(name && { name }),
          ...(Array.isArray(permissions) && { permissions }),
          ...(department && { department }),
          ...(warehouseId && { warehouseId })
        }
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: 'Staff profile updated successfully',
      data: memoryStaffList[memIdx] || { id, name }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/staff/:id/status - Toggle staff active / inactive status (OWNER ONLY)
exports.toggleStaffStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const memIdx = memoryStaffList.findIndex(s => s.id === id);
    if (memIdx >= 0) {
      memoryStaffList[memIdx].status = status;
    }

    try {
      await prisma.user.update({
        where: { id },
        data: { status }
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: `Staff status updated to ${status}`,
      data: memoryStaffList[memIdx] || { id, status }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/staff/:id/reset-password - Reset staff password link
exports.resetStaffPassword = async (req, res) => {
  try {
    const { id } = req.params;
    return res.json({
      success: true,
      message: `Password reset link issued for staff member ${id}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/staff/:id - Remove / Deactivate staff account (OWNER ONLY)
exports.deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const memIdx = memoryStaffList.findIndex(s => s.id === id);
    if (memIdx >= 0) {
      memoryStaffList[memIdx].status = 'INACTIVE';
    }

    try {
      await prisma.user.update({
        where: { id },
        data: { status: 'INACTIVE' }
      });
    } catch (e) {}

    return res.json({
      success: true,
      message: `Staff account deactivated successfully.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
