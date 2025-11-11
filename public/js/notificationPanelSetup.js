(function(){
  if (typeof window === 'undefined') return;
  if (window.setupNotificationPanel) return;

  function buscarSwitchAsociado(contenedor){
    if (!contenedor) return null;
    const identificador = contenedor.dataset ? contenedor.dataset.switch : null;
    if (identificador){
      const directo = document.getElementById(identificador);
      if (directo && directo.type === 'checkbox'){
        return directo;
      }
    }
    const interno = contenedor.querySelector ? contenedor.querySelector('input[type="checkbox"]') : null;
    if (interno){
      return interno;
    }
    const siguiente = contenedor.nextElementSibling;
    if (siguiente && siguiente.matches('label.switch')){
      const enLabel = siguiente.querySelector('input[type="checkbox"]');
      if (enLabel){
        return enLabel;
      }
    }
    return null;
  }

  function configurarContenedorNotificaciones(contenedor, inputAsociado){
    if (!contenedor) return;
    const input = inputAsociado && inputAsociado.type === 'checkbox' ? inputAsociado : buscarSwitchAsociado(contenedor);
    if (!input) return;
    if (input.id && (!contenedor.dataset || !contenedor.dataset.switch)){
      contenedor.dataset.switch = input.id;
    }
    if (!contenedor.hasAttribute('tabindex')){
      contenedor.tabIndex = 0;
    }
    if (!contenedor.hasAttribute('role')){
      contenedor.setAttribute('role', 'button');
    }
    if (input.id){
      contenedor.setAttribute('aria-controls', input.id);
    }
    const actualizarAria = ()=>{
      contenedor.setAttribute('aria-pressed', input.checked ? 'true' : 'false');
    };
    actualizarAria();
    input.addEventListener('change', actualizarAria);
    contenedor.addEventListener('click', evento=>{
      const objetivo = evento.target;
      if (objetivo === input) return;
      if (objetivo instanceof Element){
        if (objetivo.closest('label.switch')) return;
        if (objetivo.closest('input, button, a')) return;
      }
      if (input.disabled) return;
      evento.preventDefault();
      input.click();
    });
    contenedor.addEventListener('keydown', evento=>{
      if (evento.key === 'Enter' || evento.key === ' '){
        if (input.disabled) return;
        evento.preventDefault();
        input.click();
      }
    });
  }

  function generarIdSwitch(sufijo){
    const base = String(sufijo || 'opcion').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'opcion';
    let id = `notificaciones-${base}`;
    let contador = 0;
    while (document.getElementById(id)){
      contador += 1;
      id = `notificaciones-${base}-${contador}`;
    }
    return id;
  }

  function obtenerClavesNotificacionesDisponibles(grupos){
    const claves = new Set();
    if (!Array.isArray(grupos)) return [];
    grupos.forEach(grupo=>{
      if (!grupo || !Array.isArray(grupo.items)) return;
      grupo.items.forEach(item=>{
        if (item && item.clave){
          claves.add(item.clave);
        }
      });
    });
    return Array.from(claves);
  }

  function estanTodasLasPreferenciasActivas(config, grupos){
    if (!config || !config.preferencias) return false;
    if (!config.global) return false;
    const claves = obtenerClavesNotificacionesDisponibles(grupos);
    if (!claves.length) return false;
    return claves.every(clave=>Boolean(config.preferencias[clave]));
  }

  function obtenerClavesPreferencias(config, grupos){
    const clavesGrupos = obtenerClavesNotificacionesDisponibles(grupos);
    if (clavesGrupos.length) return clavesGrupos;
    if (config && config.preferencias){
      const clavesConfiguracion = Object.keys(config.preferencias);
      if (clavesConfiguracion.length) return clavesConfiguracion;
    }
    return [];
  }

  async function actualizarPreferenciasMasivas(valor, config, grupos){
    if (!window.notificationCenter) return;
    const claves = obtenerClavesPreferencias(config, grupos);
    if (!claves.length) return;
    await Promise.all(claves.map(clave=>window.notificationCenter.actualizarPreferencia(clave, valor)));
  }

  function limpiarOpcionesNotificaciones(contenedor){
    if (!contenedor) return;
    contenedor.querySelectorAll('.notificaciones-opcion[data-clave], .notificaciones-grupo-titulo').forEach(elemento=>{
      elemento.remove();
    });
  }

  function aplicarClaseRol(elemento, etiqueta){
    if (!elemento || !etiqueta) return;
    const normalizado = String(etiqueta).trim().toLowerCase();
    elemento.classList.remove('colaborador', 'jugador', 'administrador');
    if (normalizado === 'colaborador'){
      elemento.classList.add('colaborador');
    }else if (normalizado === 'jugador'){
      elemento.classList.add('jugador');
    }else if (normalizado === 'administrador'){
      elemento.classList.add('administrador');
    }
  }

  function renderizarOpcionesNotificaciones(config, grupos, contenedor){
    if (!contenedor) return;
    limpiarOpcionesNotificaciones(contenedor);
    if (!Array.isArray(grupos) || !grupos.length) return;
    const fragmento = document.createDocumentFragment();
    const preferencias = config && config.preferencias ? config.preferencias : {};
    grupos.forEach(grupo=>{
      if (!grupo || !Array.isArray(grupo.items) || !grupo.items.length) return;
      if (grupo.etiqueta){
        const titulo = document.createElement('p');
        titulo.className = 'notificaciones-grupo-titulo';
        aplicarClaseRol(titulo, grupo.etiqueta);
        titulo.textContent = grupo.etiqueta;
        fragmento.appendChild(titulo);
      }
      grupo.items.forEach(item=>{
        if (!item || !item.clave) return;
        const fila = document.createElement('div');
        fila.className = 'notificaciones-opcion notificaciones-fila';
        fila.dataset.clave = item.clave;
        const inputId = generarIdSwitch(item.clave);
        fila.dataset.switch = inputId;
        const titulo = document.createElement('span');
        titulo.className = 'notificaciones-opcion-titulo';
        titulo.textContent = item.titulo || item.clave;
        if (item.descripcion){
          const descripcion = document.createElement('small');
          descripcion.textContent = item.descripcion;
          titulo.appendChild(descripcion);
        }
        fila.appendChild(titulo);
        const control = document.createElement('label');
        control.className = 'switch';
        control.setAttribute('aria-label', item.titulo || item.clave);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = inputId;
        input.checked = Boolean(preferencias[item.clave]);
        input.addEventListener('change', async ()=>{
          if (!window.notificationCenter) return;
          const valor = input.checked;
          input.disabled = true;
          try{
            await window.notificationCenter.actualizarPreferencia(item.clave, valor);
          }catch(err){
            console.error('No se pudo actualizar la preferencia de notificación', err);
            input.checked = !valor;
          }finally{
            if (document.body.contains(input)){
              input.disabled = false;
            }
          }
        });
        const slider = document.createElement('span');
        slider.className = 'slider';
        control.appendChild(input);
        control.appendChild(slider);
        fila.appendChild(control);
        configurarContenedorNotificaciones(fila, input);
        fragmento.appendChild(fila);
      });
    });
    contenedor.appendChild(fragmento);
  }

  window.setupNotificationPanel = function setupNotificationPanel(options = {}){
    const {
      rol = 'Jugador',
      panelSelector = '#notificaciones-panel',
      globalSelector = '#notificaciones-global',
      contenidoSelector = '#notificaciones-contenido',
      todoSelector = '#notificaciones-todo',
      tituloSelector = '#notificaciones-titulo',
      encabezadoSelector = '#notificaciones-panel .notificaciones-fila-titulo'
    } = options;

    const panel = typeof panelSelector === 'string' ? document.querySelector(panelSelector) : panelSelector;
    const globalInput = typeof globalSelector === 'string' ? document.querySelector(globalSelector) : globalSelector;
    const contenido = typeof contenidoSelector === 'string' ? document.querySelector(contenidoSelector) : contenidoSelector;
    const todoInput = typeof todoSelector === 'string' ? document.querySelector(todoSelector) : todoSelector;
    const titulo = typeof tituloSelector === 'string' ? document.querySelector(tituloSelector) : tituloSelector;
    const encabezado = typeof encabezadoSelector === 'string' ? document.querySelector(encabezadoSelector) : encabezadoSelector;

    const estado = {
      panel,
      cleanup(){
        if (estado._beforeUnload){
          window.removeEventListener('beforeunload', estado._beforeUnload);
          estado._beforeUnload = null;
        }
        if (estado._desuscribir){
          try{ estado._desuscribir(); }
          catch(err){ console.error('No se pudo cancelar la suscripción de notificaciones', err); }
          estado._desuscribir = null;
        }
      }
    };

    if (!panel){
      return estado;
    }

    let gruposDisponibles = [];
    let globalInicializado = false;

    if (titulo){
      titulo.setAttribute('role', 'button');
      titulo.setAttribute('tabindex', '0');
      if (contenido){
        titulo.setAttribute('aria-controls', contenido.id || 'notificaciones-contenido');
      }
    }

    function actualizarEstadoPreferencias(){
      if (!contenido) return;
      const abierto = !globalInput || globalInput.checked;
      contenido.setAttribute('aria-hidden', abierto ? 'false' : 'true');
      if (titulo){
        titulo.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      }
      if (encabezado){
        encabezado.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      }
    }

    function alternarNotificacionesGlobal(){
      if (!globalInput || globalInput.disabled) return;
      globalInput.click();
    }

    function actualizarIndicadoresGlobal(){
      if (!globalInput) return;
      const estadoGlobal = globalInput.checked ? 'true' : 'false';
      if (titulo){
        titulo.setAttribute('aria-pressed', estadoGlobal);
        titulo.setAttribute('aria-expanded', estadoGlobal);
      }
    }

    if (globalInput){
      actualizarIndicadoresGlobal();
      globalInput.addEventListener('change', ()=>{
        globalInput.dataset.manual = 'true';
        actualizarIndicadoresGlobal();
        actualizarEstadoPreferencias();
      });
    }

    if (titulo){
      titulo.addEventListener('click', alternarNotificacionesGlobal);
      titulo.addEventListener('keydown', evento=>{
        if (evento.key === 'Enter' || evento.key === ' '){
          evento.preventDefault();
          alternarNotificacionesGlobal();
        }
      });
    }

    if (encabezado){
      configurarContenedorNotificaciones(encabezado, globalInput);
      if (contenido){
        encabezado.setAttribute('aria-controls', contenido.id || 'notificaciones-contenido');
      }
    }

    if (contenido){
      const opcionBase = contenido.querySelector('.notificaciones-opcion[data-base-opcion="true"]');
      const inputBase = opcionBase ? buscarSwitchAsociado(opcionBase) : null;
      configurarContenedorNotificaciones(opcionBase, inputBase);
    }

    if (todoInput){
      todoInput.addEventListener('change', async ()=>{
        if (!window.notificationCenter){
          todoInput.checked = false;
          return;
        }
        const activar = todoInput.checked;
        todoInput.disabled = true;
        try{
          const configuracionActual = window.notificationCenter.obtenerConfiguracion();
          const globalYaActivo = Boolean(configuracionActual && configuracionActual.global);
          if (activar && !globalYaActivo){
            const resultado = await window.notificationCenter.actualizarGlobal(true);
            if (resultado !== 'granted'){
              todoInput.checked = false;
              return;
            }
            if (globalInput){
              globalInput.checked = true;
              globalInput.dataset.manual = 'false';
            }
          }
          const configuracionPosterior = window.notificationCenter.obtenerConfiguracion();
          await actualizarPreferenciasMasivas(activar, configuracionPosterior, gruposDisponibles);
        }catch(err){
          console.error('No se pudo actualizar las preferencias de notificaciones', err);
          todoInput.checked = !activar;
        }finally{
          const configuracionFinal = window.notificationCenter ? window.notificationCenter.obtenerConfiguracion() : null;
          const clavesDisponibles = obtenerClavesPreferencias(configuracionFinal, gruposDisponibles);
          const globalHabilitado = Boolean(configuracionFinal && configuracionFinal.global);
          todoInput.disabled = !clavesDisponibles.length;
          if (!globalHabilitado && todoInput.checked){
            todoInput.checked = false;
          }
          actualizarEstadoPreferencias();
        }
      });
    }

    actualizarEstadoPreferencias();

    estado._beforeUnload = ()=>{
      estado.cleanup();
    };
    window.addEventListener('beforeunload', estado._beforeUnload);

    async function inicializar(){
      if (!panel){
        return;
      }
      if (!window.notificationCenter){
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'block';
      gruposDisponibles = window.notificationCenter.obtenerGruposUI(rol || 'Jugador');
      gruposDisponibles = Array.isArray(gruposDisponibles) ? gruposDisponibles.slice() : [];
      if (!gruposDisponibles.length){
        panel.style.display = 'none';
        return;
      }
      try{
        await window.notificationCenter.cuandoListo();
      }catch(err){
        console.error('No se pudo preparar la sección de notificaciones', err);
      }
      const configuracion = window.notificationCenter.obtenerConfiguracion();
      actualizarPanel(configuracion);
      if (estado._desuscribir){
        try{ estado._desuscribir(); }
        catch(e){ console.error('No se pudo cancelar la suscripción de notificaciones', e); }
      }
      estado._desuscribir = window.notificationCenter.onChange(cfg=>{
        actualizarPanel(cfg);
      });
    }

    function actualizarPanel(config){
      if (!panel) return;
      if (!config){
        panel.style.display = 'none';
        return;
      }
      if (!Array.isArray(gruposDisponibles) || !gruposDisponibles.length){
        panel.style.display = 'none';
        return;
      }
      panel.style.display = 'block';
      const globalActivo = Boolean(config.global);
      if (globalInput){
        const fueInicializado = globalInicializado;
        const esManual = globalInput.dataset.manual === 'true';
        if (!fueInicializado || !esManual){
          globalInput.checked = globalActivo;
          globalInput.dataset.manual = 'false';
          globalInicializado = true;
        }else if (!globalActivo && globalInput.checked){
          globalInput.checked = false;
          globalInput.dataset.manual = 'false';
        }
        actualizarIndicadoresGlobal();
      }
      if (todoInput){
        const clavesDisponibles = obtenerClavesNotificacionesDisponibles(gruposDisponibles);
        const todasActivas = estanTodasLasPreferenciasActivas(config, gruposDisponibles);
        todoInput.checked = todasActivas;
        todoInput.disabled = !clavesDisponibles.length;
      }
      renderizarOpcionesNotificaciones(config, gruposDisponibles, contenido);
      actualizarEstadoPreferencias();
    }

    estado.ready = inicializar();
    return estado;
  };
})();
