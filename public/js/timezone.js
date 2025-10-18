// Datos globales de la hora del servidor
const serverTime = {
  Pais: '',
  locale: 'es-ES',
  zonaIana: '',
  diferencia: 0,
  offsetMinutos: null
};

const IANA_OVERRIDES = {
  Venezuela: 'America/Caracas',
  Colombia: 'America/Bogota',
  Mexico: 'America/Mexico_City',
  España: 'Europe/Madrid',
  Argentina: 'America/Argentina/Buenos_Aires'
};

function obtenerOffsetMinutos(zona) {
  if (typeof zona !== 'string') return null;
  const match = zona.match(/UTC([+-])(\d{2}):(\d{2})/i);
  if (!match) return null;
  const horas = parseInt(match[2], 10);
  const minutos = parseInt(match[3], 10);
  if (Number.isNaN(horas) || Number.isNaN(minutos)) return null;
  const signo = match[1] === '-' ? 1 : -1;
  return signo * (horas * 60 + minutos);
}

function diferenciaPorOffset(offsetMinutos) {
  if (typeof offsetMinutos !== 'number' || Number.isNaN(offsetMinutos)) return 0;
  const localOffset = new Date().getTimezoneOffset();
  return (localOffset - offsetMinutos) * 60000;
}

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
  const fallback = diferenciaPorOffset(serverTime.offsetMinutos);
  if (!serverTime.zonaIana) {
    serverTime.diferencia = fallback;
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
      serverTime.diferencia = fallback;
    }
  } catch (err) {
    console.error('Error obteniendo hora del servidor', err);
    serverTime.diferencia = fallback;
  }
}

async function asegurarDb() {
  if (typeof db !== 'undefined' && db) {
    return db;
  }
  if (typeof initFirebase === 'function') {
    try {
      await initFirebase();
    } catch (err) {
      console.error('No se pudo inicializar Firebase antes de obtener la hora del servidor', err);
      throw err;
    }
  }
  if (typeof db === 'undefined' || !db) {
    throw new Error('Firestore no está disponible para obtener la hora del servidor');
  }
  return db;
}

async function initServerTime() {
  if (serverTime.zonaIana) return; // ya inicializado
  try {
    const database = await asegurarDb();
    const doc = await database.collection('Variablesglobales').doc('Parametros').get();
    if (!doc.exists) throw new Error('Documento Parametros no existe');
    const { Pais = '', ZonaHoraria = '' } = doc.data();
    serverTime.Pais = Pais;
    const locales = {
      Venezuela: 'es-VE',
      España: 'es-ES',
      Mexico: 'es-MX',
      Colombia: 'es-CO',
      Argentina: 'es-AR'
    };
    serverTime.locale = locales[Pais] || 'es-ES';
    serverTime.offsetMinutos = obtenerOffsetMinutos(ZonaHoraria);
    const override = IANA_OVERRIDES[Pais];
    const zonaNormalizada = override || parseZona(ZonaHoraria);
    serverTime.zonaIana = typeof zonaNormalizada === 'string' ? zonaNormalizada : '';
    await sincronizarHora();
    setInterval(sincronizarHora, 3600000);
  } catch (e) {
    console.error('Error obteniendo parámetros', e);
  }
}

function obtenerFecha() {
  const d = new Date(Date.now() + serverTime.diferencia);
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

function limpiarMeridiano(valor = '') {
  return valor.replace(/\s*a\.?\s*m\.?/ig, ' AM').replace(/\s*p\.?\s*m\.?/ig, ' PM');
}

function obtenerHora() {
  const d = new Date(Date.now() + serverTime.diferencia);
  const hora = d.toLocaleTimeString(serverTime.locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: serverTime.zonaIana
  });
  return limpiarMeridiano(hora);
}

async function initFechaHora(idElemento = "fecha-hora") {
  await initServerTime();
  const el = document.getElementById(idElemento);
  if (!el) return;

  function mostrar() {
    try {
      const fechaStr = obtenerFecha();
      const horaStr = obtenerHora();
      el.textContent = '';
      if (serverTime.Pais) {
        const paisSpan = document.createElement('span');
        paisSpan.className = 'pais-actual';
        paisSpan.textContent = `${serverTime.Pais} |`;
        el.appendChild(paisSpan);
        el.appendChild(document.createTextNode(' '));
      }
      const fechaSpan = document.createElement('span');
      fechaSpan.className = 'fecha-actual-icono';
      fechaSpan.textContent = fechaStr;
      el.appendChild(fechaSpan);
      el.appendChild(document.createTextNode(' '));
      const horaSpan = document.createElement('span');
      horaSpan.className = 'hora-actual-icono';
      horaSpan.textContent = horaStr;
      el.appendChild(horaSpan);
    } catch (err) {
      console.error('Error formateando fecha/hora', err);
      el.textContent = '';
    }
  }

  mostrar();
  setInterval(mostrar, 1000);
}

if (typeof window !== 'undefined') {
  window.serverTime = serverTime;
}

window.initServerTime = initServerTime;
window.fechaServidor = obtenerFecha;
window.horaServidor = obtenerHora;
window.initFechaHora = initFechaHora;
