(function initEstadoPagoPremio(global){
  const ESTADOS_CANONICOS = Object.freeze({
    PENDIENTE: 'PENDIENTE',
    REALIZADO: 'REALIZADO',
    ARCHIVADO: 'ARCHIVADO'
  });

  const ALIAS_LECTURA = Object.freeze({
    APROBADO: ESTADOS_CANONICOS.REALIZADO
  });

  function normalizarTexto(valor){
    return (valor || '').toString().trim().toUpperCase();
  }

  function normalizarLectura(valor, fallback = ESTADOS_CANONICOS.PENDIENTE){
    const texto = normalizarTexto(valor);
    if(!texto) return fallback;
    if(Object.prototype.hasOwnProperty.call(ESTADOS_CANONICOS, texto)){
      return ESTADOS_CANONICOS[texto];
    }
    if(Object.prototype.hasOwnProperty.call(ALIAS_LECTURA, texto)){
      return ALIAS_LECTURA[texto];
    }
    return fallback;
  }

  function esCanonico(valor){
    const texto = normalizarTexto(valor);
    return Boolean(texto && Object.prototype.hasOwnProperty.call(ESTADOS_CANONICOS, texto));
  }

  function validarParaGuardar(valor, contexto = ''){
    const texto = normalizarTexto(valor);
    if(!esCanonico(texto)){
      const sufijo = contexto ? ` en ${contexto}` : '';
      throw new Error(`Estado no reconocido${sufijo}: ${valor}`);
    }
    return ESTADOS_CANONICOS[texto];
  }

  function estaFinalizado(valor){
    return normalizarLectura(valor) === ESTADOS_CANONICOS.REALIZADO;
  }

  const api = Object.freeze({
    ESTADOS_CANONICOS,
    ALIAS_LECTURA,
    normalizarLectura,
    esCanonico,
    validarParaGuardar,
    estaFinalizado
  });

  global.EstadosPagoPremio = api;
})(window);
