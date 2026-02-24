(function(){
  if(window.internalTransactionNotifier) return;

  function formatoWhatsappAHtml(texto){
    const seguro=(texto||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return seguro
      .replace(/\*(.*?)\*/g,'<strong>$1</strong>')
      .replace(/_(.*?)_/g,'<em>$1</em>')
      .replace(/~(.*?)~/g,'<s>$1</s>')
      .replace(/\n/g,'<br>');
  }

  class InternalTransactionNotifier{
    constructor(){
      this.modal=null;
      this.user=null;
      this.timer=null;
      this.mostrando=false;
      this.crearModal();
      this.iniciar();
    }

    crearModal(){
      const overlay=document.createElement('div');
      overlay.id='modal-notificacion-interna';
      overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:99999;padding:16px;';
      overlay.innerHTML=`<div style="max-width:520px;width:100%;background:#fff;border-radius:12px;padding:18px;font-family:Calibri,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.3);">
        <h3 style="margin:0 0 10px 0;color:#111827;font-size:1.2rem;">Notificación de tu transacción</h3>
        <div id="mensaje-notificacion-interna" style="font-size:1rem;line-height:1.4;color:#111827;margin-bottom:14px;"></div>
        <button id="aceptar-notificacion-interna" type="button" style="background:#16a34a;color:white;border:none;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer;">Aceptar</button>
      </div>`;
      document.body.appendChild(overlay);
      this.modal=overlay;
      this.mensajeEl=overlay.querySelector('#mensaje-notificacion-interna');
      this.btnAceptar=overlay.querySelector('#aceptar-notificacion-interna');
      this.btnAceptar.addEventListener('click',()=>this.aceptarActual());
    }

    async iniciar(){
      try{ await initFirebase(); }catch(_){ return; }
      if(!window.auth || !window.db) return;
      auth.onAuthStateChanged(user=>{
        this.user=user;
        this.mostrando=false;
        this.ocultar();
        if(this.timer){ clearInterval(this.timer); this.timer=null; }
        if(!user) return;
        this.verificarPendientes();
        this.timer=setInterval(()=>this.verificarPendientes(),120000);
      });
    }

    async verificarPendientes(){
      if(!this.user || this.mostrando) return;
      const identidades=this.obtenerIdentidadesUsuario();
      let pendiente=null;
      for(const identidad of identidades){
        const snap=await this.buscarPendientePorIdentidad(identidad);
        if(!snap.empty){ pendiente=snap.docs[0]; break; }
      }
      if(!pendiente) return;
      this.actual=this.normalizarDoc(pendiente);
      this.mostrar(this.actual);
    }

    obtenerIdentidadesUsuario(){
      const identidades=[this.user && this.user.email,this.user && this.user.uid]
        .map(v=>(v||'').toString().trim())
        .filter(Boolean);
      const normalizadas=[];
      for(const valor of identidades){
        normalizadas.push(valor);
        const minuscula=valor.toLowerCase();
        if(minuscula!==valor) normalizadas.push(minuscula);
      }
      return Array.from(new Set(normalizadas));
    }

    async buscarPendientePorIdentidad(identidad){
      const ref=db.collection('transacciones');
      try{
        return await ref
          .where('IDbilletera','==',identidad)
          .where('notificacionInterna.pendienteMostrar','==',true)
          .limit(1)
          .get();
      }catch(err){
        const codigo=(err && err.code ? err.code.toString() : '').toLowerCase();
        const mensaje=(err && err.message ? err.message.toString() : '').toLowerCase();
        const requiereIndice=codigo.includes('failed-precondition') || mensaje.includes('index');
        if(!requiereIndice){
          console.warn('No se pudo consultar notificación interna pendiente',err);
          return {empty:true,docs:[]};
        }
        console.warn('Consulta de notificación interna requiere índice compuesto. Usando búsqueda alternativa por identidad.');
        try{
          const respaldo=await ref.where('IDbilletera','==',identidad).limit(25).get();
          const pendiente=respaldo.docs.find(doc=>{
            const data=doc.data()||{};
            return Boolean(data.notificacionInterna && data.notificacionInterna.pendienteMostrar===true);
          });
          return pendiente ? {empty:false,docs:[pendiente]} : {empty:true,docs:[]};
        }catch(fallbackErr){
          console.warn('No se pudo ejecutar la búsqueda alternativa de notificaciones internas',fallbackErr);
          return {empty:true,docs:[]};
        }
      }
    }

    normalizarDoc(doc){
      const data=doc.data()||{};
      const interna=data.notificacionInterna||{};
      return {id:doc.id,mensaje:interna.mensaje||'Tienes una actualización en tu transacción.',estadoObjetivo:(interna.estadoObjetivo||'').toString().toUpperCase()};
    }

    mostrar(notificacion){
      this.mostrando=true;
      this.mensajeEl.innerHTML=formatoWhatsappAHtml(notificacion.mensaje);
      this.modal.style.display='flex';
      this.btnAceptar.focus();
    }

    ocultar(){
      if(this.modal) this.modal.style.display='none';
      this.actual=null;
    }

    async aceptarActual(){
      if(!this.actual || !this.user) return;
      const ref=db.collection('transacciones').doc(this.actual.id);
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists) return;
        const data=snap.data()||{};
        const estadoActual=(data.estado||'').toString().toUpperCase();
        const interna=data.notificacionInterna||{};
        const payload={
          mensajeLeido:true,
          notificacionInterna:{
            ...interna,
            pendienteMostrar:false,
            aceptada:true,
            aceptadaEn:firebase.firestore.FieldValue.serverTimestamp(),
            aceptadaPor:this.user.email||this.user.uid||''
          }
        };
        if(estadoActual==='APROBADO'){
          payload.estado='ACEPTADO';
        }
        tx.set(ref,payload,{merge:true});
      });
      this.mostrando=false;
      this.ocultar();
    }
  }

  window.internalTransactionNotifier=new InternalTransactionNotifier();
})();
