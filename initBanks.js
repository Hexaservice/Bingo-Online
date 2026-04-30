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

const db = admin.firestore();

async function main() {
  const bancos = [
    '0108-Banco Provincial',
    '0134-Banesco Banco Universal',
    '0116-Banco Occidental de Descuento',
    '0191-Banco Nacional de Crédito',
    '0163-Banco del Tesoro',
    '0115-Banco Exterior',
    '0128-Banco Caroní',
    '0151-Banco Fondo Común',
    '0138-Banco Plaza',
    '0175-Banco Bicentenario',
    '0137-Banco Sofitasa',
    '0171-Banco Activo',
    '0104-Banco Venezolano de Crédito',
    '0166-Banco Agrícola de Venezuela',
    '0174-Banplus Banco Universal',
    '0114-Banco del Caribe',
    '0156-100% Banco',
    '0106-Banco Industrial de Venezuela',
    '0177-Banco BANFANB',
    '0168-Banco Mi Banco',
    '0146-Banco del Pueblo Soberano',
    '0121-Banco Provincial de Crédito',
    '0132-Banco Guayana',
    '0190-Citibank',
    '0187-Banco de Exportación y Comercio',
    '0172-Banco Bancamiga',
    '0193-Banco Fintec'
  ];

  for (const nombre of bancos) {
    await db.collection('Bancos').doc(nombre).set({ nombre, estado:'Activo', categoria:'Bingo' });
  }

  console.log('Bancos inicializados');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error initializing banks:', err);
  process.exit(1);
});
