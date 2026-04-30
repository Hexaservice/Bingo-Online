(function(root,factory){
  const adapter = factory();
  if(typeof module === 'object' && module.exports){ module.exports = adapter; }
  if(root){ root.globalConfigAdapter = adapter; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(){
  const DEFAULTS = Object.freeze({ Pais:'Venezuela', ZonaHoraria:'UTC-04:00', Aplicacion:'BingOnline' });
  function asTrimmed(value, fallback=''){
    if(typeof value !== 'string') return fallback;
    const cleaned = value.trim();
    return cleaned || fallback;
  }
  function normalize(raw = {}, options = {}){
    const source = raw && typeof raw === 'object' ? raw : {};
    const envDefaults = options && options.readDefaults ? options.readDefaults : {};
    return {
      Pais: asTrimmed(source.Pais, asTrimmed(envDefaults.Pais, DEFAULTS.Pais)),
      ZonaHoraria: asTrimmed(source.ZonaHoraria, asTrimmed(envDefaults.ZonaHoraria, DEFAULTS.ZonaHoraria)),
      Aplicacion: asTrimmed(source.Aplicacion, asTrimmed(envDefaults.Aplicacion, DEFAULTS.Aplicacion))
    };
  }
  function validate(normalized){
    const errors = [];
    if(!normalized || typeof normalized !== 'object'){
      errors.push('Configuración inválida: se esperaba un objeto.');
      return { valid:false, errors };
    }
    ['Pais','ZonaHoraria','Aplicacion'].forEach((key)=>{
      if(typeof normalized[key] !== 'string' || !normalized[key].trim()){
        errors.push(`Campo requerido ausente o inválido: ${key}`);
      }
    });
    return { valid: errors.length === 0, errors };
  }
  function fromSnapshot(docSnap, options = {}){
    if(!docSnap || !docSnap.exists){
      const normalized = normalize({}, options);
      return { normalized, validation: validate(normalized), source: 'fallback' };
    }
    const normalized = normalize(docSnap.data() || {}, options);
    return { normalized, validation: validate(normalized), source: 'firestore' };
  }
  return { DEFAULTS, normalize, validate, fromSnapshot };
});
