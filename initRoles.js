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

async function main() {
  const rolesRef = db.collection('roles');
  await rolesRef.doc('Superadmin').set({ emails: ['jhoseph.q@gmail.com','cyz513@gmail.com'] }, { merge: true });
  await rolesRef.doc('Administrador').set({ emails: [] }, { merge: true });
  await rolesRef.doc('Colaborador').set({ emails: [] }, { merge: true });
  console.log('Roles iniciales creados');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error initializing roles:', err);
  process.exit(1);
});
