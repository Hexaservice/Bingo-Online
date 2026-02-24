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
      const identidades=[this.user.email,this.user.uid].filter(Boolean);
      let pendiente=null;
      for(const identidad of identidades){
        const snap=await db.collection('transacciones')
          .where('IDbilletera','==',identidad)
          .where('notificacionInterna.pendienteMostrar','==',true)
          .limit(1)
          .get();
        if(!snap.empty){ pendiente=snap.docs[0]; break; }
      }
      if(!pendiente) return;
      this.actual=this.normalizarDoc(pendiente);
      this.mostrar(this.actual);
    }

    normalizarDoc(doc){
      const data=doc.data()||{};
      const interna=data.notificacionInterna||{};
      return {id:doc.id,mensaje:interna.mensaje||'Tienes una actualización en tu transacción.'};
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
      await ref.set({
        mensajeLeido:true,
        notificacionInterna:{
          pendienteMostrar:false,
          aceptada:true,
          aceptadaEn:firebase.firestore.FieldValue.serverTimestamp(),
          aceptadaPor:this.user.email||this.user.uid||''
        }
      },{merge:true});
      this.mostrando=false;
      this.ocultar();
    }
  }

  window.internalTransactionNotifier=new InternalTransactionNotifier();
})();
