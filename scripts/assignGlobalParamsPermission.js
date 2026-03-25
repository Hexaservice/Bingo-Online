#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');

const TARGET_EMAIL = 'jhoseph.q@gmail.com';
const HIGH_RISK_CLAIM = 'canManageGlobalParams';

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
  const enabledArg = String(args.enabled ?? 'true').trim().toLowerCase();
  const enabled = !['false', '0', 'no'].includes(enabledArg);

  if (!email) {
    throw new Error('Uso: node scripts/assignGlobalParamsPermission.js --email jhoseph.q@gmail.com [--enabled true|false]');
  }
  if (email !== TARGET_EMAIL) {
    throw new Error(`Permiso de alto riesgo restringido. Solo se permite para ${TARGET_EMAIL}.`);
  }

  const credentialsPath = resolveCredentialsPath();
  admin.initializeApp({
    credential: admin.credential.cert(require(credentialsPath))
  });

  const auth = admin.auth();
  const db = admin.firestore();
  const userRecord = await auth.getUserByEmail(email);
  const nextClaims = {
    ...(userRecord.customClaims || {}),
    [HIGH_RISK_CLAIM]: enabled
  };

  await auth.setCustomUserClaims(userRecord.uid, nextClaims);

  await db.collection('users').doc(email).set({
    [HIGH_RISK_CLAIM]: enabled,
    globalParamsPermissionManagedBy: 'admin-script',
    globalParamsPermissionUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log(`Claim ${HIGH_RISK_CLAIM}=${enabled} asignado a ${email} (uid: ${userRecord.uid}).`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error al asignar permiso de parámetros globales:', err.message || err);
  process.exit(1);
});
