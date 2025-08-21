async function initFechaHora(idElemento="fecha-hora"){
  try{
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
    if(!doc.exists) return;
    const { Pais, ZonaHoraria } = doc.data();
    const el = document.getElementById(idElemento);
    if(!el || !ZonaHoraria) return;
    async function actualizar(){
      try{
        const resp = await fetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(ZonaHoraria)}`);
        const data = await resp.json();
        const fecha = new Date(data.datetime);
        const fechaStr = fecha.toLocaleDateString('es-ES',{timeZone:ZonaHoraria,year:'numeric',month:'long',day:'numeric'});
        const horaStr = fecha.toLocaleString('en-US',{timeZone:ZonaHoraria,hour:'2-digit',minute:'2-digit',hour12:true}).toLowerCase();
        el.textContent = `${Pais}, ${fechaStr}, ${horaStr}`;
      }catch(err){
        console.error('Error obteniendo hora del servidor', err);
      }
    }
    await actualizar();
    setInterval(actualizar,60000);
  }catch(e){
    console.error('Error obteniendo parámetros', e);
  }
}
