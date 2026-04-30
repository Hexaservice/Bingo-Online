const admin = require('firebase-admin');
const fs = require('fs');

console.warn('[DEPRECATION] initUsers.js está deprecado y es candidato a retiro. Use `npm run assign-role` para altas/cambios de roles y claims de forma granular.');

const DEFAULT_CLAIMS_BY_ROLE = {
  Superadmin: {
    role: 'Superadmin',
    roles: ['Superadmin'],
    admin: true,
  },
};

let credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
if (!fs.existsSync(credentialsPath)) {
  console.error('Service account credentials not found at', credentialsPath);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(credentialsPath)),
});

const db = admin.firestore();
const auth = admin.auth();

async function ensureAuthUser(email) {
  try {
    const userRecord = await auth.getUserByEmail(email);
    console.log(`[Auth] Usuario encontrado: ${email} (uid=${userRecord.uid})`);
    return userRecord;
  } catch (error) {
    if (error && error.code === 'auth/user-not-found') {
      const created = await auth.createUser({ email });
      console.log(`[Auth] Usuario no existía y fue creado: ${email} (uid=${created.uid})`);
      return created;
    }

    const details = error?.message || error;
    console.error(`[Auth] No se pudo verificar/crear el usuario ${email}:`, details);
    throw error;
  }
}

async function syncSpecialUser(email, role) {
  const ref = db.collection('users').doc(email);
  const doc = await ref.get();

  if (!doc.exists) {
    await ref.set({
      email,
      alias: email.split('@')[0],
      role,
      aceptoNotificaciones: 'NO',
    });
    console.log(`[Firestore] Creado users/${email} con role=${role}`);
  } else if (doc.data().role !== role) {
    await ref.update({ role });
    console.log(`[Firestore] Actualizado users/${email}.role a ${role}`);
  } else {
    console.log(`[Firestore] users/${email}.role ya estaba en ${role}`);
  }

  const authUser = await ensureAuthUser(email);
  const claims = DEFAULT_CLAIMS_BY_ROLE[role];

  if (claims) {
    await auth.setCustomUserClaims(authUser.uid, claims);
    console.log(`[Claims] Aplicado claim para ${email}: ${JSON.stringify(claims)}`);
  } else {
    console.log(`[Claims] Sin cambios para ${email}: no hay claims definidos para role=${role}`);
  }
}

async function main() {
  await syncSpecialUser('jhoseph.q@gmail.com', 'Superadmin');
  await syncSpecialUser('cyz513@gmail.com', 'Superadmin');
  await syncSpecialUser('hexaservice.co@gmail.com', 'Colaborador');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Failed to initialize users:', err);
  process.exit(1);
});
