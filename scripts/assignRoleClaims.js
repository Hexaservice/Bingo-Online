#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');

const ALLOWED_ROLES = ['Jugador', 'Colaborador', 'Administrador', 'Superadmin'];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function resolveCredentialsPath() {
  const provided = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
  if (!fs.existsSync(provided)) {
    throw new Error(`No se encontró el archivo de credenciales en: ${provided}`);
  }
  return provided;
}

async function main() {
  const args = parseArgs(process.argv);
  const email = String(args.email || '').trim().toLowerCase();
  const role = String(args.role || '').trim();
  const forceAdmin = args.admin === true || String(args.admin || '').toLowerCase() === 'true';

  if (!email || !role) {
    throw new Error('Uso: node scripts/assignRoleClaims.js --email usuario@dominio.com --role <Jugador|Colaborador|Administrador|Superadmin> [--admin true]');
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new Error(`Rol inválido. Permitidos: ${ALLOWED_ROLES.join(', ')}`);
  }

  const credentialsPath = resolveCredentialsPath();
  admin.initializeApp({
    credential: admin.credential.cert(require(credentialsPath))
  });

  const auth = admin.auth();
  const db = admin.firestore();

  const userRecord = await auth.getUserByEmail(email);
  const nextClaims = {
    role,
    roles: [role],
    admin: forceAdmin || role === 'Superadmin'
  };

  await auth.setCustomUserClaims(userRecord.uid, nextClaims);

  await db.collection('users').doc(email).set({
    email,
    role,
    roleManagedBy: 'admin-script',
    roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    uid: userRecord.uid
  }, { merge: true });

  console.log(`Rol ${role} y custom claims asignados a ${email} (uid: ${userRecord.uid}).`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error al asignar rol/claims:', err.message || err);
  process.exit(1);
});
