const admin = require('firebase-admin');

let firebaseAdminApp = null;

try {
  const existingApps = admin.apps || [];
  if (existingApps.length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      firebaseAdminApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase Admin SDK initialized via service account JSON.');
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      firebaseAdminApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
      console.log('✅ Firebase Admin SDK initialized via env credentials.');
    } else {
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "invintell-dd772";
      firebaseAdminApp = admin.initializeApp({
        projectId
      });
      console.log(`ℹ️ Firebase Admin SDK initialized with project ID: ${projectId}`);
    }
  } else {
    firebaseAdminApp = existingApps[0];
  }
} catch (err) {
  console.warn('⚠️ Firebase Admin SDK initialization warning:', err.message);
}

function getFirebaseAuth() {
  try {
    if (admin && typeof admin.auth === 'function') {
      return admin.auth();
    }
  } catch (e) {
    console.warn('⚠️ Firebase Auth access warning:', e.message);
  }
  return null;
}

module.exports = {
  admin,
  firebaseAdminInitialized: !!firebaseAdminApp,
  getFirebaseAuth
};
