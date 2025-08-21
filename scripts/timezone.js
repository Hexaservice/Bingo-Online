async function initFechaHora(idElemento = "fecha-hora") {
  const el = document.getElementById(idElemento);
  if (!el) return;

  try {
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
    if (!doc.exists) throw new Error('Documento Parametros no existe');

    const { Pais = '', ZonaHoraria = '' } = doc.data();

    const locales = {
      Venezuela: 'es-VE',
      España: 'es-ES',
      Mexico: 'es-MX',
      Colombia: 'es-CO',
      Argentina: 'es-AR'
    };
    const locale = locales[Pais] || 'es-ES';

    function parseZona(zona) {
      const match = zona.match(/^UTC([+-])(\d{2}):(\d{2})$/);
      if (match) {
        const sign = match[1] === '-' ? '+' : '-';
        const h = String(parseInt(match[2], 10));
        return `Etc/GMT${sign}${h}`;
      }
      return zona;
    }

    const zonaIana = parseZona(ZonaHoraria);
    let diferencia = 0;

    async function sincronizar() {
      if (!zonaIana) {
        diferencia = 0;
        return;
      }
      try {
        const resp = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(zonaIana)}`);
        if (!resp.ok) throw new Error('Respuesta no válida');
        const data = await resp.json();
        const serverDate = new Date(data.datetime);
        if (!isNaN(serverDate)) {
          diferencia = serverDate.getTime() - Date.now();
        } else {
          diferencia = 0;
        }
      } catch (err) {
        console.error('Error obteniendo hora del servidor', err);
        diferencia = 0;
      }
    }

    function mostrar() {
      const ahora = new Date(Date.now() + diferencia);
      const opcionesFecha = { year: 'numeric', month: 'long', day: 'numeric', timeZone: zonaIana };
      const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: zonaIana };
      try {
        const fechaStr = ahora.toLocaleDateString(locale, opcionesFecha);
        let horaStr = ahora.toLocaleTimeString(locale, opcionesHora);
        horaStr = horaStr.replace(' a. m.', ' am').replace(' p. m.', ' pm');
        el.textContent = `${fechaStr}, ${horaStr}`;
      } catch (err) {
        console.error('Error formateando fecha/hora', err);
        el.textContent = '';
      }
    }

    await sincronizar();
    mostrar();
    setInterval(mostrar, 1000);
    setInterval(sincronizar, 3600000);
  } catch (e) {
    console.error('Error obteniendo parámetros', e);
    setTimeout(() => initFechaHora(idElemento), 60000);
  }
}
