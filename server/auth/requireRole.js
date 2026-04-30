const admin = require('firebase-admin');

function parseBearerToken(authHeader = '') {
  const match = authHeader.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}

function requireRole(allowedRoles = [], options = {}) {
  const {
    onForbidden = 'Acceso restringido',
    roleSource = async (email) => {
      const doc = await admin.firestore().collection('users').doc(email).get();
      return doc.exists ? doc.data()?.role : undefined;
    }
  } = options;

  return async function roleMiddleware(req, res, next) {
    const token = parseBearerToken(req.headers.authorization || '');
    if (!token) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verificando token', error);
      return res.status(401).json({ error: 'Token inválido' });
    }

    const email = decoded?.email;
    if (!email) {
      return res.status(401).json({ error: 'Token sin correo asociado' });
    }

    try {
      const role = await roleSource(email);
      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ error: onForbidden });
      }

      req.user = { uid: decoded.uid, email, role };
      return next();
    } catch (error) {
      console.error('Error obteniendo el rol del usuario', error);
      return res.status(500).json({ error: 'Error verificando permisos', message: error.message });
    }
  };
}

module.exports = {
  requireRole,
  parseBearerToken
};
