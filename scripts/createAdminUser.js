require('dotenv').config();
const { getFirebaseAuth } = require('../src/config/firebaseAdmin');

async function createAdminUser() {
  const adminEmail = 'admin@invintell.io';
  const adminPassword = 'AdminPassword123!';
  const adminName = 'System Owner Admin';

  console.log(`🔐 Setting up Admin Credentials in Firebase Auth...`);
  console.log(`Email: ${adminEmail}`);
  console.log(`Password: ${adminPassword}`);

  const auth = getFirebaseAuth();
  if (auth) {
    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(adminEmail);
        console.log(`✅ Found existing Firebase user: ${userRecord.email} (UID: ${userRecord.uid})`);

        // Reset password to guarantee it works for login
        await auth.updateUser(userRecord.uid, { 
          password: adminPassword,
          displayName: adminName
        });
        console.log(`🔑 Successfully set password for ${adminEmail} to: ${adminPassword}`);
      } catch (notFound) {
        userRecord = await auth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: adminName
        });
        console.log(`✅ Successfully created new Firebase Admin user: ${userRecord.email} (UID: ${userRecord.uid})`);
      }
    } catch (err) {
      console.error('❌ Firebase Auth error:', err.message);
    }
  } else {
    console.warn('⚠️ Firebase Admin SDK not initialized');
  }
}

createAdminUser()
  .then(() => {
    console.log('✅ Admin Setup Process Complete!');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
