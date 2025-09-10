const admin = require('firebase-admin');

// Verificar variable de entorno para credenciales
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Falta la variable de entorno GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}

// Inicializa Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ----- Lógica de sincronización de hora (adaptado de scripts/timezone.js) -----
const serverTime = { zonaIana: '', diferencia: 0 };

function parseZona(zona) {
  const match = zona.match(/^UTC([+-])(\d{2}):(\d{2})$/);
  if (match) {
    const sign = match[1] === '-' ? '+' : '-';
    const h = String(parseInt(match[2], 10));
    return `Etc/GMT${sign}${h}`;
  }
  return zona;
}

async function sincronizarHora() {
  if (!serverTime.zonaIana) {
    serverTime.diferencia = 0;
    return;
  }
  try {
    const resp = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(serverTime.zonaIana)}`);
    if (!resp.ok) throw new Error('Respuesta no válida');
    const data = await resp.json();
    const serverDate = new Date(data.datetime);
    if (!isNaN(serverDate)) {
      serverTime.diferencia = serverDate.getTime() - Date.now();
    } else {
      serverTime.diferencia = 0;
    }
  } catch (err) {
    console.error('Error obteniendo hora del servidor', err);
    serverTime.diferencia = 0;
  }
}

async function initServerTime() {
  try {
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
    if (!doc.exists) throw new Error('Documento Parametros no existe');
    const { ZonaHoraria = '' } = doc.data();
    serverTime.zonaIana = parseZona(ZonaHoraria);
    await sincronizarHora();
    setInterval(sincronizarHora, 3600000);
  } catch (e) {
    console.error('Error obteniendo parámetros', e);
  }
}

// ----- Lógica de actualización de estados -----
async function actualizarEstadosSorteos() {
  if (!serverTime.zonaIana) await initServerTime();
  const ahora = new Date(Date.now() + serverTime.diferencia);
  try {
    const snap = await db.collection('sorteos').where('estado', 'in', ['Activo', 'Sellado']).get();
    const updates = [];
    snap.forEach(doc => {
      const d = doc.data();
      if (!d.fecha || !d.hora) return;
      const [dia, mes, anio] = d.fecha.split('/').map(n => parseInt(n, 10));
      const [hor, min] = d.hora.split(':').map(n => parseInt(n, 10));
      const sorteoDate = new Date(anio, mes - 1, dia, hor, min);
      const cierre = parseInt(d.cierreMinutos || 0, 10);
      const selladoDate = new Date(sorteoDate.getTime() - cierre * 60000);
      if (d.estado === 'Activo') {
        if (ahora >= sorteoDate) {
          updates.push(doc.ref.update({ estado: 'Jugando' }));
        } else if (ahora >= selladoDate) {
          updates.push(doc.ref.update({ estado: 'Sellado' }));
        }
      } else if (d.estado === 'Sellado' && ahora >= sorteoDate) {
        updates.push(doc.ref.update({ estado: 'Jugando' }));
      }
    });
    if (updates.length > 0) {
      await Promise.all(updates);
      console.log(`Actualizados ${updates.length} sorteos a las ${ahora.toISOString()}`);
    }
  } catch (e) {
    console.error('Error actualizando estados de sorteos', e);
  }
}

async function main() {
  await initServerTime();
  await actualizarEstadosSorteos();
  setInterval(actualizarEstadosSorteos, 60000);
}

main().catch(e => {
  console.error('Error en el proceso de actualización', e);
  process.exit(1);
});

