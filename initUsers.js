const admin = require('firebase-admin');
const fs = require('fs');

let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
if (!fs.existsSync(credentialsPath)) {
  console.error('Service account credentials not found at', credentialsPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(credentialsPath)),
});

const rawDatabaseId = (process.env.FIRESTORE_DATABASE_ID || '').trim();
const databaseId = /^(default|\(default\))$/i.test(rawDatabaseId) ? '' : rawDatabaseId;
const app = admin.app();
const db = databaseId ? admin.firestore(app, databaseId) : admin.firestore(app);

async function createUser(email, role) {
  const ref = db.collection('users').doc(email);
  const doc = await ref.get();
  if (!doc.exists) {
    await ref.set({
      email,
      alias: email.split('@')[0],
      role,
    });
    console.log(`Created user ${email} with role ${role}`);
  } else {
    if (doc.data().role !== role) {
      await ref.update({ role });
      console.log(`Updated role for ${email} to ${role}`);
    } else {
      console.log(`User ${email} already exists`);
    }
  }
}

async function main() {
  await createUser('jhoseph.q@gmail.com', 'Superadmin');
  await createUser('cyz513@gmail.com', 'Superadmin');
  await createUser('hexaservice.co@gmail.com', 'Colaborador');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Failed to initialize users:', err);
  process.exit(1);
});
