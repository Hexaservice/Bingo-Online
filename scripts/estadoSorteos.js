async function actualizarEstadosSorteos(){
  await initServerTime();
  const ahora = new Date(Date.now() + serverTime.diferencia);
  try{
    const snap = await db.collection('sorteos').where('estado','in',['Activo','Sellado']).get();
    const updates=[];
    snap.forEach(doc=>{
      const d=doc.data();
      if(!d.fecha || !d.hora) return;
      const [dia,mes,anio]=d.fecha.split('/').map(n=>parseInt(n,10));
      const [hor,min]=d.hora.split(':').map(n=>parseInt(n,10));
      const sorteoDate=new Date(anio,mes-1,dia,hor,min);
      const cierre=parseInt(d.cierreMinutos||0,10);
      const selladoDate=new Date(sorteoDate.getTime()-cierre*60000);
      if(d.estado==='Activo'){
        if(ahora>=sorteoDate){
          updates.push(doc.ref.update({estado:'Jugando'}));
        }else if(ahora>=selladoDate){
          updates.push(doc.ref.update({estado:'Sellado'}));
        }
      }else if(d.estado==='Sellado' && ahora>=sorteoDate){
        updates.push(doc.ref.update({estado:'Jugando'}));
      }
    });
    await Promise.all(updates);
  }catch(e){
    console.error('Error actualizando estados de sorteos',e);
  }
}

async function iniciarControlSorteos(){
  await actualizarEstadosSorteos();
  setInterval(actualizarEstadosSorteos,60000);
}

window.actualizarEstadosSorteos=actualizarEstadosSorteos;
window.iniciarControlSorteos=iniciarControlSorteos;
