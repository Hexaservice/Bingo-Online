function resolveRoleFromClaims(claims = {}){
  if(typeof claims.role === 'string' && claims.role.trim()){
    return claims.role.trim();
  }
  if(Array.isArray(claims.roles) && claims.roles.length){
    const rol = claims.roles.find(r => typeof r === 'string' && r.trim());
    if(rol) return rol;
  }
  return null;
}

function resolveRoleFromUserDoc(docData = {}){
  if(docData && typeof docData.role === 'string' && docData.role.trim()){
    return docData.role.trim();
  }
  return 'Jugador';
}

module.exports = {
  resolveRoleFromClaims,
  resolveRoleFromUserDoc
};
