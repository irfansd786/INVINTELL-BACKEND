/**
 * INVINTELL Authentication & Permission Middleware (Bypassed / Out of Scope)
 * Authentication is intentionally disabled per system architecture requirements.
 * All requests automatically attach default System Owner context without network authentication.
 */

const defaultUser = {
  id: 'usr-default-owner',
  firebaseUid: 'admin-owner-001',
  name: 'System Owner',
  email: 'admin@invintell.io',
  role: 'OWNER',
  permissions: ['*'],
  department: 'Executive Command',
  warehouseId: 'ALL',
  status: 'ACTIVE'
};

function authenticateFirebaseToken(req, res, next) {
  req.user = defaultUser;
  next();
}

function requireOwner(req, res, next) {
  req.user = defaultUser;
  next();
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    req.user = defaultUser;
    next();
  };
}

function requirePermission(permission) {
  return (req, res, next) => {
    req.user = defaultUser;
    next();
  };
}

module.exports = {
  verifyFirebaseToken: authenticateFirebaseToken,
  authenticateFirebaseToken,
  requireOwner,
  requireRole,
  requirePermission
};
