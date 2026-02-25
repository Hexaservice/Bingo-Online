#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');

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

function normalizarEstado(estado) {
  const texto = (estado || '').toString().trim().toUpperCase();
  if (texto === 'REALIZADO') return 'APROBADO';
  return texto;
}

function estadoFinalizado(estado) {
  const normalizado = normalizarEstado(estado);
  return normalizado === 'APROBADO' || normalizado === 'ACEPTADO';
}

async function main() {
  const args = parseArgs(process.argv);
  const sorteoIdFiltro = String(args.sorteoId || '').trim();
  const guardar = args.guardar !== 'false';

  const credentialsPath = resolveCredentialsPath();
  admin.initializeApp({
    credential: admin.credential.cert(require(credentialsPath))
  });

  const db = admin.firestore();
  const [premiosSnap, pendientesSnap] = await Promise.all([
    sorteoIdFiltro
      ? db.collection('PremiosSorteos').where('sorteoId', '==', sorteoIdFiltro).get()
      : db.collection('PremiosSorteos').get(),
    sorteoIdFiltro
      ? db.collection('AcreditacionesPendientes').where('sorteoId', '==', sorteoIdFiltro).get()
      : db.collection('AcreditacionesPendientes').get()
  ]);

  const pendientesPorEvento = new Map();
  pendientesSnap.forEach(doc => {
    const data = doc.data() || {};
    const eventoGanadorId = (data.eventoGanadorId || doc.id || '').toString();
    if (!eventoGanadorId) return;
    pendientesPorEvento.set(eventoGanadorId, {
      id: doc.id,
      estado: normalizarEstado(data.estado)
    });
  });

  const huerfanos = [];
  premiosSnap.forEach(doc => {
    const data = doc.data() || {};
    const estado = normalizarEstado(data.estado);
    if (estadoFinalizado(estado) || estado === 'ARCHIVADO') return;
    const eventoGanadorId = (data.eventoGanadorId || doc.id || '').toString();
    const match = pendientesPorEvento.get(eventoGanadorId);
    if (!match || estadoFinalizado(match.estado)) {
      huerfanos.push({
        premioId: doc.id,
        eventoGanadorId,
        sorteoId: (data.sorteoId || '').toString(),
        estadoPremio: estado,
        creditos: Number(data.creditos) || 0,
        cartones: Number(data.cartones) || 0
      });
    }
  });

  const resumen = {
    tipo: 'PREMIOS_VS_ACREDITACIONES',
    sorteoIdFiltro: sorteoIdFiltro || null,
    totalPremios: premiosSnap.size,
    totalAcreditacionesPendientes: pendientesSnap.size,
    totalHuerfanos: huerfanos.length,
    huerfanos: huerfanos.slice(0, 500),
    ejecutadoAt: admin.firestore.FieldValue.serverTimestamp(),
    ejecutadoPor: 'script:reconciliarPremiosPendientes'
  };

  if (guardar) {
    await db.collection('AcreditacionesReconciliacion').add(resumen);
  }

  console.log('Resumen de reconciliación:');
  console.log(JSON.stringify({
    sorteoIdFiltro: resumen.sorteoIdFiltro,
    totalPremios: resumen.totalPremios,
    totalAcreditacionesPendientes: resumen.totalAcreditacionesPendientes,
    totalHuerfanos: resumen.totalHuerfanos
  }, null, 2));

  if (huerfanos.length) {
    console.log('\nMuestra de huérfanos:');
    huerfanos.slice(0, 20).forEach((item, idx) => {
      console.log(`${idx + 1}. premioId=${item.premioId} eventoGanadorId=${item.eventoGanadorId} sorteoId=${item.sorteoId} estado=${item.estadoPremio}`);
    });
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error('Error ejecutando reconciliación:', err.message || err);
  process.exit(1);
});
