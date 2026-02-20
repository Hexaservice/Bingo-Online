(function initSorteoAutoPrizeEligibility(root, factory){
  if(typeof module === 'object' && module.exports){
    module.exports = factory();
    return;
  }
  root.SorteoAutoPrizeEligibility = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function crearSorteoAutoPrizeEligibility(){
  const ESTADOS_PERMITIDOS_ACREDITACION_AUTOMATICA = Object.freeze([
    'SELLADO',
    'JUGANDO',
    'FINALIZANDO',
    'FINALIZADO'
  ]);

  const ESTADOS_PERMITIDOS_SET = new Set(ESTADOS_PERMITIDOS_ACREDITACION_AUTOMATICA);

  function normalizeSorteoState(value){
    return (value || '').toString().trim().toUpperCase();
  }

  function isSorteoEligibleForAutoPrize({ estado, premiosCorteCerrado } = {}){
    if(Boolean(premiosCorteCerrado)) return false;
    return ESTADOS_PERMITIDOS_SET.has(normalizeSorteoState(estado));
  }

  return Object.freeze({
    ESTADOS_PERMITIDOS_ACREDITACION_AUTOMATICA,
    normalizeSorteoState,
    isSorteoEligibleForAutoPrize
  });
});
