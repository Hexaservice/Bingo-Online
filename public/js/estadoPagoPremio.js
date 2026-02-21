(function initEstadoPagoPremio(root, factory){
  if(typeof module === 'object' && module.exports){
    module.exports = factory();
    return;
  }
  const api = factory();
  root.EstadosPagoPremio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function crearEstadoPagoPremio(){
  const ESTADOS_CANONICOS = Object.freeze({
    PENDIENTE: 'PENDIENTE',
    APROBADO: 'APROBADO',
    ARCHIVADO: 'ARCHIVADO'
  });

  const ALIAS_LECTURA = Object.freeze({
    REALIZADO: ESTADOS_CANONICOS.APROBADO
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
    return normalizarLectura(valor) === ESTADOS_CANONICOS.APROBADO;
  }

  return Object.freeze({
    ESTADOS_CANONICOS,
    ALIAS_LECTURA,
    normalizarLectura,
    esCanonico,
    validarParaGuardar,
    estaFinalizado
  });
});
