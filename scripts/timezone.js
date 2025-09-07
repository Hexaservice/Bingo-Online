// Datos globales de la hora del servidor
const serverTime = {
  Pais: '',
  locale: 'es-ES',
  zonaIana: '',
  diferencia: 0
};

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
  if (serverTime.zonaIana) return; // ya inicializado
  try {
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
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
    serverTime.zonaIana = parseZona(ZonaHoraria);
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

function obtenerHora() {
  const d = new Date(Date.now() + serverTime.diferencia);
  return d.toLocaleTimeString(serverTime.locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: serverTime.zonaIana
  });
}

async function initFechaHora(idElemento = "fecha-hora") {
  await initServerTime();
  const el = document.getElementById(idElemento);
  if (!el) return;

  function mostrar() {
    const ahora = new Date(Date.now() + serverTime.diferencia);
    const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric', timeZone: serverTime.zonaIana };
    const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: serverTime.zonaIana };
    try {
      const fechaStr = ahora.toLocaleDateString(serverTime.locale, opcionesFecha);
      let horaStr = ahora.toLocaleTimeString(serverTime.locale, opcionesHora);
      horaStr = horaStr.replace(' a. m.', ' am').replace(' p. m.', ' pm');
      el.textContent = `${serverTime.Pais}, ${fechaStr}, ${horaStr}`;
    } catch (err) {
      console.error('Error formateando fecha/hora', err);
      el.textContent = '';
    }
  }

  mostrar();
  setInterval(mostrar, 1000);
}

window.initServerTime = initServerTime;
window.fechaServidor = obtenerFecha;
window.horaServidor = obtenerHora;
window.initFechaHora = initFechaHora;
