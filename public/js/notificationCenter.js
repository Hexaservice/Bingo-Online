(function(){
  if(typeof window === 'undefined') return;
  if(window.notificationCenter) return;

  const GRUPOS_NOTIFICACIONES = {
    Jugador: {
      etiqueta: 'Jugador',
      items: [
        { clave: 'sorteoNuevo', titulo: 'Notificación Sorteo Nuevo', descripcion: 'Se envía cuando se crea un sorteo.' },
        { clave: 'sorteoJugando', titulo: 'Notificación Sorteo Jugando', descripcion: 'Te avisa cuando un sorteo inicia la partida.' },
        { clave: 'estatusDeposito', titulo: 'Notificación Estatus Depósito', descripcion: 'Recibe cambios de estado de tus depósitos.' },
        { clave: 'premio', titulo: 'Notificación Premio', descripcion: 'Recibe aviso cuando un premio se acredita en tu billetera.' }
      ]
    },
    Colaborador: {
      etiqueta: 'Colaborador',
      items: [
        { clave: 'depositosPendientes', titulo: 'Notificación Depósitos Pendientes', descripcion: 'Se repite cada 10 minutos si hay depósitos por gestionar.' },
        { clave: 'retirosPendientes', titulo: 'Notificación Retiros Pendientes', descripcion: 'Se repite cada 10 minutos si hay retiros por gestionar.' },
        { clave: 'mensajeDepositoAprobado', titulo: 'Redacción de mensajes DEPÓSITO APROBADO', descripcion: '✅ Permite activar la redacción automatica de mensajes WhatsApp para enviar al jugador una notificacion de Depósito', color: '#0b6b27' },
        { clave: 'mensajeRetiroAprobado', titulo: 'Redacción de mensajes RETIRO APROBADO', descripcion: '✅ Permite activar la redacción automatica de mensajes WhatsApp para enviar al jugador una notificacion de Retiro', color: '#8b0000' },
        { clave: 'mensajeDepositoAnulado', titulo: 'Redacción de mensajes DEPÓSITO ANULADO', descripcion: '🚫 Permite activar la redacción automatica de mensajes WhatsApp para enviar al jugador una notificacion de Depósito Anulado', color: '#0a8800' },
        { clave: 'mensajeRetiroAnulado', titulo: 'Redacción de mensajes RETIRO ANULADO', descripcion: '🚫 Permite activar la redacción automatica de mensajes WhatsApp para enviar al jugador una notificacion de Retiro Anulado', color: '#d32f2f' }
      ]
    },
    Administrador: {
      etiqueta: 'Administrador',
      items: [
        { clave: 'depositosPendientes', titulo: 'Notificación Depósitos Pendientes', descripcion: 'Se repite cada 10 minutos si hay depósitos por gestionar.' },
        { clave: 'retirosPendientes', titulo: 'Notificación Retiros Pendientes', descripcion: 'Se repite cada 10 minutos si hay retiros por gestionar.' },
        { clave: 'selladoSorteo', titulo: 'Notificación Sellado Sorteo', descripcion: 'Cuando llega la hora de sellado de un sorteo.' },
        { clave: 'juegoEnVivoSorteo', titulo: 'Notificación Juego en vivo Sorteo', descripcion: 'Cuando llega la hora de inicio de un sorteo.' },
        { clave: 'gestionPagos', titulo: 'Notificación Gestión Pagos', descripcion: 'Aviso único si hay gestiones de pagos pendientes.' },
        { clave: 'mensajeDepositoAprobado', titulo: 'Redacción de mensajes DEPÓSITO APROBADO', descripcion: '✅ Permite activar la redacción automatica de mensajes WhatsApp para enviar al jugador una notificacion de Depósito', color: '#0b6b27' },
        { clave: 'mensajeRetiroAprobado', titulo: 'Redacción de mensajes RETIRO APROBADO', descripcion: '✅ Permite activar la redacción automatica de mensajes WhatsApp para enviar al jugador una notificacion de Retiro', color: '#8b0000' },
        { clave: 'mensajeDepositoAnulado', titulo: 'Redacción de mensajes DEPÓSITO ANULADO', descripcion: '🚫 Permite activar la redacción automatica de mensajes WhatsApp para enviar al jugador una notificacion de Depósito Anulado', color: '#0a8800' },
        { clave: 'mensajeRetiroAnulado', titulo: 'Redacción de mensajes RETIRO ANULADO', descripcion: '🚫 Permite activar la redacción automatica de mensajes WhatsApp para enviar al jugador una notificacion de Retiro Anulado', color: '#d32f2f' }
      ]
    }
  };

  const INTERVALOS_REPETICION = {
    depositosPendientes: 600000,
    retirosPendientes: 600000,
    gestionPagos: 600000
  };

  const MAPA_ROLES = {
    jugador: 'Jugador',
    user: 'Jugador',
    colaborador: 'Colaborador',
    collab: 'Colaborador',
    admin: 'Administrador',
    administrador: 'Administrador',
    administrator: 'Administrador',
    superadmin: 'Superadmin',
    super: 'Superadmin'
  };

  function normalizarRolEntrada(valor){
    if(!valor) return 'Jugador';
    const clave = valor.toString().trim().toLowerCase();
    return MAPA_ROLES[clave] || valor;
  }

  const HISTORIAL_FABRICAS = {
    sorteoNuevo: () => ({ ids: {} }),
    sorteoJugando: () => ({ ids: {} }),
    estatusDeposito: () => ({ ids: {} }),
    premio: () => ({ ids: {} }),
    depositosPendientes: () => ({ ultimoEnvio: 0 }),
    retirosPendientes: () => ({ ultimoEnvio: 0 }),
    gestionPagos: () => ({ ultimoEnvio: 0 }),
    selladoSorteo: () => ({ ids: {} }),
    juegoEnVivoSorteo: () => ({ ids: {} })
  };

  function clonar(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function historialVacio(){
    const base = {};
    Object.keys(HISTORIAL_FABRICAS).forEach(clave => {
      base[clave] = HISTORIAL_FABRICAS[clave]();
    });
    return base;
  }

  function clavesPorRol(role){
    role = normalizarRolEntrada(role);
    const claves = new Set();
    if(role === 'Superadmin'){
      Object.values(GRUPOS_NOTIFICACIONES).forEach(grupo => grupo.items.forEach(item => claves.add(item.clave)));
      return Array.from(claves);
    }
    if(role === 'Colaborador'){
      GRUPOS_NOTIFICACIONES.Colaborador.items.forEach(item => claves.add(item.clave));
      GRUPOS_NOTIFICACIONES.Jugador.items.forEach(item => claves.add(item.clave));
      return Array.from(claves);
    }
    if(role === 'Administrador'){
      GRUPOS_NOTIFICACIONES.Administrador.items.forEach(item => claves.add(item.clave));
      GRUPOS_NOTIFICACIONES.Colaborador.items.forEach(item => claves.add(item.clave));
      GRUPOS_NOTIFICACIONES.Jugador.items.forEach(item => claves.add(item.clave));
      return Array.from(claves);
    }
    GRUPOS_NOTIFICACIONES.Jugador.items.forEach(item => claves.add(item.clave));
    return Array.from(claves);
  }

  function crearModalPermiso({ titulo, mensaje, onSi, onNo, onNoMostrar }){
    if(typeof document === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.55)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '12000';

    const caja = document.createElement('div');
    caja.style.background = '#fff';
    caja.style.borderRadius = '18px';
    caja.style.padding = '24px';
    caja.style.boxSizing = 'border-box';
    caja.style.maxWidth = '420px';
    caja.style.width = '90%';
    caja.style.fontFamily = "'Poppins', sans-serif";
    caja.style.textAlign = 'center';
    caja.style.boxShadow = '0 12px 30px rgba(0,0,0,0.25)';

    const h2 = document.createElement('h2');
    h2.textContent = titulo;
    h2.style.margin = '0 0 12px';
    h2.style.color = '#0b1b4d';

    const p = document.createElement('p');
    p.textContent = mensaje;
    p.style.margin = '0 0 20px';
    p.style.color = '#333';

    const contenedorBotones = document.createElement('div');
    contenedorBotones.style.display = 'flex';
    contenedorBotones.style.flexDirection = 'column';
    contenedorBotones.style.gap = '10px';

    function crearBoton(texto, color, accion){
      const btn = document.createElement('button');
      btn.textContent = texto;
      btn.style.padding = '10px 16px';
      btn.style.borderRadius = '10px';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';
      btn.style.background = color;
      btn.style.color = '#fff';
      btn.style.fontSize = '1rem';
      btn.style.fontFamily = "'Poppins', sans-serif";
      btn.addEventListener('click', ()=>{
        overlay.remove();
        accion();
      }, { once: true });
      return btn;
    }

    contenedorBotones.appendChild(crearBoton('Sí, activar', '#0a8800', onSi));
    contenedorBotones.appendChild(crearBoton('No por ahora', '#c62828', onNo));
    contenedorBotones.appendChild(crearBoton('No mostrar de nuevo', '#616161', onNoMostrar));

    caja.appendChild(h2);
    caja.appendChild(p);
    caja.appendChild(contenedorBotones);
    overlay.appendChild(caja);

    document.body.appendChild(overlay);
  }

  const CAMPO_CONSENTIMIENTO = 'aceptoNotificaciones';

  class CentroNotificaciones {
    constructor(){
      this.usuario = null;
      this.rol = null;
      this.config = {
        global: false,
        ultimaRespuesta: '',
        preferencias: {},
        historial: historialVacio(),
        fechaUltimoPrompt: null,
        consentimiento: 'NO'
      };
      this.listeners = new Set();
      this.desuscriptores = [];
      this.temporizadores = {};
      this.inicializaciones = {
        sorteos: false,
        transJugador: false
      };
      this.cache = {
        sorteos: new Map(),
        pendientes: {
          depositosPendientes: new Set(),
          retirosPendientes: new Set(),
          gestionPagos: 0
        },
        resumenPagos: { premios: 0, pagos: 0 },
        verificadorSorteos: null
      };
      this.guardadoPreferencias = null;
      this.pendienteHistorial = null;
      this.timerHistorial = null;
      this.rolesActivos = new Set();
      this.resetReady();
    }

    resetReady(pendiente = false){
      if(pendiente){
        this.readyPromise = new Promise(resolve => {
          this.readyResolver = resolve;
        });
      }else{
        this.readyPromise = Promise.resolve();
        this.readyResolver = ()=>{};
      }
    }

    cuandoListo(){
      return this.readyPromise;
    }

    obtenerConfiguracion(){
      return clonar(this.config);
    }

    onChange(callback){
      if(typeof callback !== 'function') return ()=>{};
      this.listeners.add(callback);
      callback(this.obtenerConfiguracion());
      return ()=>this.listeners.delete(callback);
    }

    notificarCambios(){
      const copia = this.obtenerConfiguracion();
      this.listeners.forEach(cb => {
        try{ cb(copia); }
        catch(err){ console.error('Error notificando cambios de configuración', err); }
      });
    }

    async vincularUsuario(user, role){
      if(!user){
        this.desvincularUsuario();
        return;
      }
      const mismo = this.usuario && this.usuario.email === user.email && this.rol === role;
      if(mismo) return this.cuandoListo();
      this.desvincularUsuario();
      this.resetReady(true);
      this.usuario = user;
      this.rol = normalizarRolEntrada(role);
      try{
        if(typeof initFirebase === 'function'){
          await initFirebase();
        }
        const doc = await db.collection('users').doc(user.email).get();
        const data = doc.exists ? (doc.data() || {}) : {};
        await this.cargarConfiguracion(data);
        await this.verificarSolicitudInicial();
        this.iniciarMonitoreos();
      }catch(err){
        console.error('No se pudo configurar el centro de notificaciones', err);
      }finally{
        this.readyResolver();
        this.notificarCambios();
      }
      return this.cuandoListo();
    }

    desvincularUsuario(){
      this.usuario = null;
      this.rol = null;
      this.config = {
        global: false,
        ultimaRespuesta: '',
        preferencias: {},
        historial: historialVacio(),
        fechaUltimoPrompt: null,
        consentimiento: 'NO'
      };
      this.cancelarMonitoreos();
      this.rolesActivos.clear();
      this.inicializaciones = { sorteos: false, transJugador: false };
      this.cache = {
        sorteos: new Map(),
        pendientes: {
          depositosPendientes: new Set(),
          retirosPendientes: new Set(),
          gestionPagos: 0
        },
        resumenPagos: { premios: 0, pagos: 0 },
        verificadorSorteos: null
      };
      if(this.timerHistorial){
        clearTimeout(this.timerHistorial);
        this.timerHistorial = null;
      }
      this.resetReady();
    }

    cancelarMonitoreos(){
      this.desuscriptores.forEach(fn => {
        try{ fn(); }catch(err){ console.warn('No se pudo desuscribir un monitor de notificaciones', err); }
      });
      this.desuscriptores = [];
      Object.values(this.temporizadores).forEach(id => clearInterval(id));
      this.temporizadores = {};
      if(this.cache.verificadorSorteos){
        clearInterval(this.cache.verificadorSorteos);
        this.cache.verificadorSorteos = null;
      }
    }

    async cargarConfiguracion(rawUsuario){
      const raw = rawUsuario && rawUsuario.notificationSettings ? rawUsuario.notificationSettings : {};
      const claves = clavesPorRol(normalizarRolEntrada(this.rol));
      const preferencias = {};
      const origenPreferencias = raw.preferencias || {};
      let requiereGuardado = false;
      claves.forEach(clave => {
        if(typeof origenPreferencias[clave] === 'boolean'){
          preferencias[clave] = origenPreferencias[clave];
        }else{
          preferencias[clave] = false;
          requiereGuardado = true;
        }
      });
      this.config = {
        global: Boolean(raw.global),
        ultimaRespuesta: raw.ultimaRespuesta || raw.lastChoice || '',
        preferencias,
        historial: historialVacio(),
        fechaUltimoPrompt: raw.fechaUltimoPrompt || raw.lastPromptAt || null,
        consentimiento: 'NO'
      };
      const origenHistorial = raw.historial || raw.history || {};
      Object.keys(this.config.historial).forEach(clave => {
        if(origenHistorial[clave]){
          this.config.historial[clave] = { ...this.config.historial[clave], ...origenHistorial[clave] };
        }
      });
      const consentimientoRaw = rawUsuario && typeof rawUsuario[CAMPO_CONSENTIMIENTO] === 'string'
        ? rawUsuario[CAMPO_CONSENTIMIENTO].toUpperCase()
        : null;
      if(consentimientoRaw === 'SI'){
        this.config.consentimiento = 'SI';
      }else{
        this.config.consentimiento = 'NO';
        if(!consentimientoRaw){
          requiereGuardado = true;
        }
      }
      if(requiereGuardado){
        await this.guardarPreferencias();
      }
    }

    async verificarSolicitudInicial(){
      if(!this.usuario) return;
      const hayVentana = typeof hasWindow === 'function' ? hasWindow() : (typeof window !== 'undefined');
      if(!hayVentana) return;
      if(this.config.global || this.config.consentimiento === 'SI'){
        if(this.config.global){
          const resultadoPermiso = await this.solicitarPermisoNavegador();
          if(resultadoPermiso !== 'granted'){
            this.config.global = false;
            this.config.consentimiento = 'NO';
            if(this.config.ultimaRespuesta !== 'no_mostrar'){
              this.config.ultimaRespuesta = 'no';
            }
            this.establecerPreferenciasIniciales(false);
            this.config.fechaUltimoPrompt = Date.now();
            await this.guardarPreferencias();
            this.notificarCambios();
          }
        }
        return;
      }
      if(this.config.ultimaRespuesta === 'no_mostrar') return;
      await new Promise(resolve => {
        crearModalPermiso({
          titulo: '¿Deseas recibir notificaciones?',
          mensaje: 'Activa las notificaciones para estar informado en tiempo real.',
          onSi: async ()=>{
            this.config.fechaUltimoPrompt = Date.now();
            const resultado = await this.actualizarGlobal(true);
            if(resultado !== 'granted'){
              this.config.ultimaRespuesta = 'no';
            }else{
              this.config.ultimaRespuesta = 'si';
            }
            resolve();
          },
          onNo: async ()=>{
            this.config.global = false;
            this.config.ultimaRespuesta = 'no';
            this.config.fechaUltimoPrompt = Date.now();
            this.establecerPreferenciasIniciales(false);
            this.config.consentimiento = 'NO';
            await this.guardarPreferencias();
            resolve();
            this.notificarCambios();
          },
          onNoMostrar: async ()=>{
            this.config.global = false;
            this.config.ultimaRespuesta = 'no_mostrar';
            this.config.fechaUltimoPrompt = Date.now();
            this.establecerPreferenciasIniciales(false);
            this.config.consentimiento = 'NO';
            await this.guardarPreferencias();
            resolve();
            this.notificarCambios();
          }
        });
      });
    }

    establecerPreferenciasIniciales(valor){
      Object.keys(this.config.preferencias).forEach(clave => {
        this.config.preferencias[clave] = Boolean(valor);
      });
    }

    async solicitarPermisoNavegador(){
      if(typeof Notification === 'undefined') return 'unsupported';
      try{
        if(Notification.permission === 'granted') return 'granted';
        if(Notification.permission === 'denied') return 'denied';
        const resultado = await Notification.requestPermission();
        return resultado;
      }catch(err){
        console.warn('No se pudo solicitar el permiso de notificaciones del navegador', err);
        return 'error';
      }
    }

    async guardarPreferencias(){
      if(!this.usuario) return;
      if(typeof db === 'undefined') return;
      const payload = {
        notificationSettings: {
          global: this.config.global,
          ultimaRespuesta: this.config.ultimaRespuesta,
          preferencias: this.config.preferencias,
          historial: this.config.historial,
          fechaUltimoPrompt: this.config.fechaUltimoPrompt || Date.now()
        },
        [CAMPO_CONSENTIMIENTO]: this.config.consentimiento === 'SI' ? 'SI' : 'NO'
      };
      try{
        await db.collection('users').doc(this.usuario.email).set(payload, { merge: true });
      }catch(err){
        console.error('Error guardando las preferencias de notificaciones', err);
      }
    }

    programarGuardadoHistorial(){
      if(this.timerHistorial) return;
      this.timerHistorial = setTimeout(()=>{
        this.timerHistorial = null;
        this.guardarHistorial();
      }, 500);
    }

    async guardarHistorial(){
      if(!this.usuario || typeof db === 'undefined') return;
      try{
        await db.collection('users').doc(this.usuario.email).set({
          notificationSettings: { historial: this.config.historial }
        }, { merge: true });
      }catch(err){
        console.error('No se pudo guardar el historial de notificaciones', err);
      }
    }

    async actualizarGlobal(valor){
      const activar = Boolean(valor);
      if(activar){
        const resultado = await this.solicitarPermisoNavegador();
        if(resultado === 'granted'){
          this.config.global = true;
          this.config.consentimiento = 'SI';
          this.config.ultimaRespuesta = 'si';
          this.establecerPreferenciasIniciales(true);
        }else{
          this.config.global = false;
          this.config.consentimiento = 'NO';
          if(this.config.ultimaRespuesta !== 'no_mostrar'){
            this.config.ultimaRespuesta = 'no';
          }
          this.establecerPreferenciasIniciales(false);
          const puedeAlertar = (typeof hasWindow === 'function' ? hasWindow() : (typeof window !== 'undefined')) && typeof alert === 'function';
          if(puedeAlertar){
            if(resultado === 'denied'){
              alert('No fue posible habilitar las notificaciones porque el permiso fue denegado en el navegador.');
            }else if(resultado === 'unsupported'){
              alert('Tu navegador no soporta notificaciones push.');
            }else if(resultado === 'error'){
              alert('Ocurrió un problema al solicitar el permiso de notificaciones.');
            }
          }
        }
        this.config.fechaUltimoPrompt = Date.now();
        await this.guardarPreferencias();
        this.notificarCambios();
        return resultado;
      }
      this.config.global = false;
      this.config.consentimiento = 'NO';
      if(this.config.ultimaRespuesta !== 'no_mostrar'){
        this.config.ultimaRespuesta = 'no';
      }
      this.establecerPreferenciasIniciales(false);
      this.config.fechaUltimoPrompt = Date.now();
      await this.guardarPreferencias();
      this.notificarCambios();
      return 'desactivado';
    }

    async actualizarPreferencia(clave, valor){
      if(!(clave in this.config.preferencias)) return;
      this.config.preferencias[clave] = Boolean(valor);
      await this.guardarPreferencias();
      this.notificarCambios();
    }

    obtenerGruposUI(role){
      role = normalizarRolEntrada(role);
      if(role === 'Superadmin'){
        return [GRUPOS_NOTIFICACIONES.Colaborador, GRUPOS_NOTIFICACIONES.Jugador, GRUPOS_NOTIFICACIONES.Administrador].filter(Boolean);
      }
      if(role === 'Colaborador'){
        return [GRUPOS_NOTIFICACIONES.Colaborador, GRUPOS_NOTIFICACIONES.Jugador].filter(Boolean);
      }
      if(role === 'Administrador'){
        return [GRUPOS_NOTIFICACIONES.Administrador, GRUPOS_NOTIFICACIONES.Colaborador, GRUPOS_NOTIFICACIONES.Jugador].filter(Boolean);
      }
      return [GRUPOS_NOTIFICACIONES.Jugador];
    }

    iniciarMonitoreos(){
      if(!this.usuario) return;
      const roles = new Set();
      roles.add('Jugador');
      if(this.rol === 'Colaborador' || this.rol === 'Superadmin' || this.rol === 'Administrador') roles.add('Colaborador');
      if(this.rol === 'Administrador' || this.rol === 'Superadmin') roles.add('Administrador');
      roles.forEach(role => this.iniciarRol(role));
    }

    iniciarRol(role){
      if(this.rolesActivos.has(role)) return;
      switch(role){
        case 'Jugador':
          this.iniciarMonitoreoJugador();
          break;
        case 'Colaborador':
          this.iniciarMonitoreoColaborador();
          break;
        case 'Administrador':
          this.iniciarMonitoreoAdministrador();
          break;
      }
      this.rolesActivos.add(role);
    }

    iniciarMonitoreoJugador(){
      if(typeof db === 'undefined') return;
      try{
        const unsubSorteos = db.collection('sorteos').onSnapshot(snapshot => {
          if(!this.inicializaciones.sorteos){
            snapshot.forEach(doc => this.cache.sorteos.set(doc.id, doc.data() || {}));
            this.inicializaciones.sorteos = true;
            return;
          }
          snapshot.docChanges().forEach(cambio => {
            const id = cambio.doc.id;
            if(cambio.type === 'removed'){
              this.cache.sorteos.delete(id);
              return;
            }
            const data = cambio.doc.data() || {};
            const anterior = this.cache.sorteos.get(id);
            this.cache.sorteos.set(id, data);
            if(cambio.type === 'added'){
              this.notificarSorteoNuevo(id, data);
            }
            if(cambio.type === 'modified'){
              if(anterior && anterior.estado !== data.estado && data.estado === 'Jugando'){
                this.notificarSorteoJugando(id, data);
              }
            }
          });
        }, err => console.error('Error escuchando sorteos para notificaciones', err));
        this.desuscriptores.push(unsubSorteos);
      }catch(err){
        console.error('No se pudo iniciar el monitoreo de sorteos', err);
      }

      try{
        const correo = this.usuario.email;
        const unsubTrans = db.collection('transacciones')
          .where('IDbilletera','==', correo)
          .where('tipotrans','in',['deposito','premio'])
          .onSnapshot(snapshot => {
            if(!this.inicializaciones.transJugador){
              this.inicializaciones.transJugador = true;
              return;
            }
            snapshot.docChanges().forEach(cambio => {
              const data = cambio.doc.data() || {};
              const tipo = (data.tipotrans || '').toLowerCase();
              const estado = (data.estado || '').toUpperCase();
              if(tipo === 'deposito' && (estado === 'APROBADO' || estado === 'ANULADO')){
                this.notificarCambioDeposito(cambio.doc.id, data, estado);
              }
              if(tipo === 'premio' && estado === 'APROBADO'){
                this.notificarPremio(cambio.doc.id, data);
              }
            });
          }, err => console.error('Error escuchando transacciones del jugador', err));
        this.desuscriptores.push(unsubTrans);
      }catch(err){
        console.error('No se pudo observar las transacciones del jugador', err);
      }
    }

    iniciarMonitoreoColaborador(){
      if(typeof db === 'undefined') return;
      try{
        const unsub = db.collection('transacciones')
          .where('estado','==','PENDIENTE')
          .where('tipotrans','in',['deposito','retiro'])
          .onSnapshot(snapshot => {
            const depositos = new Set();
            const retiros = new Set();
            snapshot.forEach(doc => {
              const data = doc.data() || {};
              const tipo = (data.tipotrans || '').toLowerCase();
              if(tipo === 'deposito') depositos.add(doc.id);
              if(tipo === 'retiro') retiros.add(doc.id);
            });
            this.gestionarPendientes('depositosPendientes', depositos, conteo => `Tienes ${conteo} depósito(s) pendiente(s) por gestionar.`);
            this.gestionarPendientes('retirosPendientes', retiros, conteo => `Tienes ${conteo} retiro(s) pendiente(s) por gestionar.`);
          }, err => console.error('Error escuchando transacciones pendientes', err));
        this.desuscriptores.push(unsub);
      }catch(err){
        console.error('No se pudo observar las solicitudes pendientes', err);
      }
    }

    iniciarMonitoreoAdministrador(){
      if(typeof db === 'undefined') return;
      try{
        const unsubPremios = db.collection('PremiosSorteos')
          .where('estado','==','PENDIENTE')
          .onSnapshot(snapshot => {
            this.cache.resumenPagos.premios = snapshot.size;
            this.gestionarPagosPendientes();
          }, err => console.error('Error escuchando premios pendientes', err));
        this.desuscriptores.push(unsubPremios);
      }catch(err){
        console.error('No se pudieron observar premios pendientes', err);
      }
      try{
        const unsubPagos = db.collection('PagosAdministracion')
          .where('estado','==','PENDIENTE')
          .onSnapshot(snapshot => {
            this.cache.resumenPagos.pagos = snapshot.size;
            this.gestionarPagosPendientes();
          }, err => console.error('Error escuchando pagos administrativos pendientes', err));
        this.desuscriptores.push(unsubPagos);
      }catch(err){
        console.error('No se pudieron observar las gestiones de pagos', err);
      }
      this.iniciarVerificacionSorteos();
    }

    iniciarVerificacionSorteos(){
      if(this.cache.verificadorSorteos){
        clearInterval(this.cache.verificadorSorteos);
      }
      if(typeof initServerTime === 'function'){
        initServerTime().catch(err => console.error('No se pudo sincronizar la hora del servidor', err));
      }
      const revisar = ()=>{
        if(!this.cache.sorteos.size) return;
        const ahora = typeof obtenerFechaServidor === 'function' ? obtenerFechaServidor() : new Date();
        this.cache.sorteos.forEach((data, id) => {
          const fecha = data.fecha;
          const hora = data.hora;
          const cierre = data.horacierre;
          if(!fecha) return;
          const momentoCierre = this.combinarFechaHora(fecha, cierre);
          const momentoInicio = this.combinarFechaHora(fecha, hora);
          if(momentoCierre && ahora >= momentoCierre && (data.estado === 'Activo' || data.estado === 'Sellado')){
            this.notificarSellado(id, data);
          }
          if(momentoInicio && ahora >= momentoInicio && data.estado !== 'Jugando' && data.estado !== 'Finalizado'){
            this.notificarJuegoEnVivo(id, data);
          }
        });
      };
      this.cache.verificadorSorteos = setInterval(revisar, 60000);
      revisar();
      this.desuscriptores.push(()=>{
        clearInterval(this.cache.verificadorSorteos);
        this.cache.verificadorSorteos = null;
      });
    }

    combinarFechaHora(fecha, hora){
      if(!fecha) return null;
      const partesFecha = fecha.split('-');
      if(partesFecha.length < 3) return null;
      const anio = parseInt(partesFecha[0],10);
      const mes = parseInt(partesFecha[1],10);
      const dia = parseInt(partesFecha[2],10);
      if(!anio || !mes || !dia) return null;
      let horas = 0;
      let minutos = 0;
      if(typeof hora === 'string' && hora.includes(':')){
        const partes = hora.split(':');
        horas = parseInt(partes[0],10) || 0;
        minutos = parseInt(partes[1],10) || 0;
      }
      return new Date(anio, mes-1, dia, horas, minutos, 0, 0);
    }

    puedeNotificar(clave){
      if(!this.config.global) return false;
      if(!(clave in this.config.preferencias)) return false;
      return Boolean(this.config.preferencias[clave]);
    }

    yaNotificado(clave, id){
      if(!id) return false;
      const historial = this.config.historial[clave];
      if(!historial || !historial.ids) return false;
      return Boolean(historial.ids[id]);
    }

    registrarHistorial(clave, id){
      const historial = this.config.historial[clave];
      if(!historial) return;
      if(historial.ids){
        historial.ids[id] = true;
      }else if(typeof historial.ultimoEnvio === 'number'){
        historial.ultimoEnvio = Date.now();
      }
      this.programarGuardadoHistorial();
    }

    verificarIntervalo(clave, esNuevo){
      const historial = this.config.historial[clave];
      if(!historial || typeof historial.ultimoEnvio !== 'number') return true;
      const ahora = Date.now();
      const ultimo = historial.ultimoEnvio || 0;
      if(esNuevo && !ultimo){
        historial.ultimoEnvio = ahora;
        this.programarGuardadoHistorial();
        return true;
      }
      const intervalo = INTERVALOS_REPETICION[clave] || 600000;
      if(!ultimo || (ahora - ultimo) >= intervalo){
        historial.ultimoEnvio = ahora;
        this.programarGuardadoHistorial();
        return true;
      }
      return false;
    }

    emitirNotificacion(clave, mensaje, titulo){
      if(!mensaje) return;
      const tituloFinal = titulo || 'Bingo Online';
      let mostrada = false;
      if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
        try{
          new Notification(tituloFinal, {
            body: mensaje,
            icon: 'img/android-chrome-192x192.png',
            tag: `${clave}-${Date.now()}`
          });
          mostrada = true;
        }catch(err){
          console.warn('No se pudo mostrar la notificación del navegador', err);
        }
      }
      if(!mostrada){
        try{ alert(mensaje); }
        catch(err){ console.warn('No se pudo mostrar alerta de notificación', err); }
      }
    }

    notificarRepeticion(clave, mensaje, esNuevo){
      if(!this.puedeNotificar(clave)) return;
      if(!this.verificarIntervalo(clave, esNuevo)) return;
      this.emitirNotificacion(clave, mensaje);
    }

    configurarTemporizador(clave, mensajeFn){
      if(this.temporizadores[clave]) return;
      const intervalo = INTERVALOS_REPETICION[clave] || 600000;
      this.temporizadores[clave] = setInterval(()=>{
        if(!this.puedeNotificar(clave)) return;
        const mensaje = mensajeFn(this.obtenerConteoPendiente(clave));
        if(!mensaje) return;
        if(this.verificarIntervalo(clave, false)){
          this.emitirNotificacion(clave, mensaje);
        }
      }, intervalo);
    }

    detenerTemporizador(clave){
      if(this.temporizadores[clave]){
        clearInterval(this.temporizadores[clave]);
        delete this.temporizadores[clave];
      }
    }

    obtenerConteoPendiente(clave){
      if(clave === 'gestionPagos') return this.cache.pendientes.gestionPagos || 0;
      const conjunto = this.cache.pendientes[clave];
      return conjunto ? conjunto.size : 0;
    }

    gestionarPendientes(clave, nuevos, mensajeFn){
      const anteriores = this.cache.pendientes[clave] || new Set();
      const huboNuevo = Array.from(nuevos).some(id => !anteriores.has(id));
      this.cache.pendientes[clave] = nuevos;
      const conteo = nuevos.size;
      if(conteo>0){
        const mensaje = mensajeFn(conteo);
        this.notificarRepeticion(clave, mensaje, huboNuevo || !anteriores.size);
        this.configurarTemporizador(clave, cantidad => mensajeFn(cantidad));
      }else{
        this.detenerTemporizador(clave);
        const historial = this.config.historial[clave];
        if(historial && typeof historial.ultimoEnvio === 'number'){
          historial.ultimoEnvio = 0;
          this.programarGuardadoHistorial();
        }
      }
    }

    gestionarPagosPendientes(){
      const total = (this.cache.resumenPagos.premios || 0) + (this.cache.resumenPagos.pagos || 0);
      this.cache.pendientes.gestionPagos = total;
      const historial = this.config.historial.gestionPagos;
      if(total>0){
        const mensaje = total>0 ? `Existen ${total} gestión(es) de pago pendientes en Centro de Pagos.` : '';
        if(historial && historial.ultimoEnvio === 0 && this.puedeNotificar('gestionPagos')){
          historial.ultimoEnvio = Date.now();
          this.programarGuardadoHistorial();
          this.emitirNotificacion('gestionPagos', mensaje);
        }
      }else{
        this.detenerTemporizador('gestionPagos');
        if(historial){
          historial.ultimoEnvio = 0;
          this.programarGuardadoHistorial();
        }
      }
    }

    notificarSorteoNuevo(id, data){
      if(!this.puedeNotificar('sorteoNuevo')) return;
      if(this.yaNotificado('sorteoNuevo', id)) return;
      const nombre = data.nombre || 'Nuevo sorteo';
      const mensaje = `Se creó el sorteo "${nombre}".`;
      this.emitirNotificacion('sorteoNuevo', mensaje, 'Nuevo sorteo disponible');
      this.registrarHistorial('sorteoNuevo', id);
    }

    notificarSorteoJugando(id, data){
      if(!this.puedeNotificar('sorteoJugando')) return;
      if(this.yaNotificado('sorteoJugando', id)) return;
      const nombre = data.nombre || 'Un sorteo';
      const mensaje = `El sorteo "${nombre}" está en vivo.`;
      this.emitirNotificacion('sorteoJugando', mensaje, 'Sorteo en vivo');
      this.registrarHistorial('sorteoJugando', id);
    }

    notificarCambioDeposito(id, data, estado){
      if(!this.puedeNotificar('estatusDeposito')) return;
      const clave = `${id}:${estado}`;
      if(this.yaNotificado('estatusDeposito', clave)) return;
      const monto = parseFloat(data.Monto || data.MontoSolicitado || 0) || 0;
      const montoTxt = monto ? monto.toFixed(2) : '';
      let mensaje = 'Tu solicitud de depósito cambió de estado.';
      if(estado === 'APROBADO') mensaje = montoTxt ? `Tu depósito de ${montoTxt} fue aprobado.` : 'Tu depósito fue aprobado.';
      if(estado === 'ANULADO') mensaje = montoTxt ? `Tu depósito de ${montoTxt} fue anulado.` : 'Tu depósito fue anulado.';
      this.emitirNotificacion('estatusDeposito', mensaje, 'Actualización de depósito');
      this.registrarHistorial('estatusDeposito', clave);
    }

    notificarPremio(id, data){
      if(!this.puedeNotificar('premio')) return;
      if(this.yaNotificado('premio', id)) return;
      const monto = parseFloat(data.Monto || 0) || 0;
      const mensaje = monto ? `Tu premio de ${monto.toFixed(2)} fue acreditado.` : 'Tu premio fue acreditado en tu billetera.';
      this.emitirNotificacion('premio', mensaje, 'Premio acreditado');
      this.registrarHistorial('premio', id);
    }

    notificarSellado(id, data){
      if(!this.puedeNotificar('selladoSorteo')) return;
      if(this.yaNotificado('selladoSorteo', id)) return;
      const nombre = data.nombre || 'Un sorteo';
      const mensaje = `El sorteo "${nombre}" ya puede ser sellado.`;
      this.emitirNotificacion('selladoSorteo', mensaje, 'Hora de sellar sorteo');
      this.registrarHistorial('selladoSorteo', id);
    }

    notificarJuegoEnVivo(id, data){
      if(!this.puedeNotificar('juegoEnVivoSorteo')) return;
      if(this.yaNotificado('juegoEnVivoSorteo', id)) return;
      const nombre = data.nombre || 'Un sorteo';
      const mensaje = `El sorteo "${nombre}" puede iniciar.`;
      this.emitirNotificacion('juegoEnVivoSorteo', mensaje, 'Hora de iniciar sorteo');
      this.registrarHistorial('juegoEnVivoSorteo', id);
    }
  }

  window.notificationCenter = new CentroNotificaciones();
})();
