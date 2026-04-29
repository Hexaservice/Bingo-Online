require('dotenv').config();
const { initializeFirebaseAdmin } = require('./firebaseAdminConfig');

let admin;
try {
  admin = initializeFirebaseAdmin();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const db = admin.firestore();

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
