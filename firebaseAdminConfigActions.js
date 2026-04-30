const DEV_PROJECT_ID = 'bingo-online-dev';
const ALLOWED_KEYS = ['targetProjectId', 'settings'];
const ALLOWED_SETTINGS_KEYS = ['maintenanceMode', 'maxUploadSizeMb', 'allowedOrigins'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function sanitizePayload(payload) {
  return {
    targetProjectId: payload.targetProjectId,
    settings: {
      ...(typeof payload.settings.maintenanceMode === 'boolean' ? { maintenanceMode: payload.settings.maintenanceMode } : {}),
      ...(typeof payload.settings.maxUploadSizeMb === 'number' ? { maxUploadSizeMb: payload.settings.maxUploadSizeMb } : {}),
      ...(Array.isArray(payload.settings.allowedOrigins) ? { allowedOrigins: [...payload.settings.allowedOrigins] } : {})
    }
  };
}

function resolveProjectId(admin) {
  return admin.app().options.projectId || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || null;
}

function validateDevRuntime(admin, targetProjectId) {
  if (process.env.NODE_ENV !== 'development') {
    return { ok: false, error: 'Operación permitida solo en NODE_ENV=development' };
  }

  const resolvedProjectId = resolveProjectId(admin);
  const expectedDevProjectId = process.env.FIREBASE_DEV_PROJECT_ID || DEV_PROJECT_ID;

  if (!resolvedProjectId && !targetProjectId) {
    return { ok: false, error: 'No se pudo resolver projectId en runtime ni en payload' };
  }

  const effectiveProjectId = targetProjectId || resolvedProjectId;

  if (effectiveProjectId !== DEV_PROJECT_ID || expectedDevProjectId !== DEV_PROJECT_ID) {
    return {
      ok: false,
      error: `Proyecto inválido. Solo se permite ${DEV_PROJECT_ID}. Recibido=${effectiveProjectId}, FIREBASE_DEV_PROJECT_ID=${expectedDevProjectId}`,
      effectiveProjectId
    };
  }

  if (resolvedProjectId && resolvedProjectId !== DEV_PROJECT_ID) {
    return {
      ok: false,
      error: `Runtime apuntando a proyecto no permitido (${resolvedProjectId}). Debe ser ${DEV_PROJECT_ID}`,
      effectiveProjectId
    };
  }

  return { ok: true, effectiveProjectId };
}

function validateFirebaseDevConfigPayload(payload) {
  if (!isPlainObject(payload)) {
    return { ok: false, error: 'Payload inválido: se esperaba un objeto JSON' };
  }

  const unknownRootKeys = Object.keys(payload).filter((key) => !ALLOWED_KEYS.includes(key));
  if (unknownRootKeys.length) {
    return { ok: false, error: `Payload inválido: claves no permitidas (${unknownRootKeys.join(', ')})` };
  }

  if (payload.targetProjectId !== undefined && typeof payload.targetProjectId !== 'string') {
    return { ok: false, error: 'targetProjectId debe ser string' };
  }

  if (!isPlainObject(payload.settings)) {
    return { ok: false, error: 'settings es requerido y debe ser objeto' };
  }

  const unknownSettingsKeys = Object.keys(payload.settings).filter((key) => !ALLOWED_SETTINGS_KEYS.includes(key));
  if (unknownSettingsKeys.length) {
    return { ok: false, error: `settings contiene claves no permitidas (${unknownSettingsKeys.join(', ')})` };
  }

  if ('maintenanceMode' in payload.settings && typeof payload.settings.maintenanceMode !== 'boolean') {
    return { ok: false, error: 'settings.maintenanceMode debe ser boolean' };
  }

  if ('maxUploadSizeMb' in payload.settings) {
    const value = payload.settings.maxUploadSizeMb;
    if (!Number.isInteger(value) || value < 1 || value > 50) {
      return { ok: false, error: 'settings.maxUploadSizeMb debe ser entero entre 1 y 50' };
    }
  }

  if ('allowedOrigins' in payload.settings) {
    if (!Array.isArray(payload.settings.allowedOrigins) || payload.settings.allowedOrigins.length > 20) {
      return { ok: false, error: 'settings.allowedOrigins debe ser arreglo con máximo 20 elementos' };
    }
    const invalidOrigin = payload.settings.allowedOrigins.find((origin) => typeof origin !== 'string' || origin.length < 1 || origin.length > 200);
    if (invalidOrigin !== undefined) {
      return { ok: false, error: 'settings.allowedOrigins solo puede contener strings de 1 a 200 caracteres' };
    }
  }

  return { ok: true, sanitizedPayload: sanitizePayload(payload) };
}

async function createAuditLog({ admin, actor, sanitizedPayload, result, targetProjectId, errorMessage }) {
  await admin.firestore().collection('admin_audit_logs').add({
    actor,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    payload: sanitizedPayload,
    result,
    targetProjectId,
    ...(errorMessage ? { errorMessage } : {})
  });
}

async function applyFirebaseDevConfig({ admin, actor, payload }) {
  const validation = validateFirebaseDevConfigPayload(payload);
  if (!validation.ok) {
    return { status: 400, body: { error: validation.error } };
  }

  const { sanitizedPayload } = validation;
  const guard = validateDevRuntime(admin, sanitizedPayload.targetProjectId);

  if (!guard.ok) {
    await createAuditLog({
      admin,
      actor,
      sanitizedPayload,
      result: 'rejected',
      targetProjectId: guard.effectiveProjectId || sanitizedPayload.targetProjectId || null,
      errorMessage: guard.error
    });
    return { status: 403, body: { error: guard.error } };
  }

  try {
    await admin.firestore().collection('admin_settings').doc('firebase_dev_config').set({
      ...sanitizedPayload.settings,
      targetProjectId: guard.effectiveProjectId,
      updatedBy: actor,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await createAuditLog({
      admin,
      actor,
      sanitizedPayload,
      result: 'success',
      targetProjectId: guard.effectiveProjectId
    });

    return { status: 200, body: { status: 'ok', targetProjectId: guard.effectiveProjectId } };
  } catch (error) {
    await createAuditLog({
      admin,
      actor,
      sanitizedPayload,
      result: 'error',
      targetProjectId: guard.effectiveProjectId,
      errorMessage: error.message
    });

    return { status: 500, body: { error: 'Error aplicando configuración de Firebase dev', message: error.message } };
  }
}

module.exports = { applyFirebaseDevConfig };
