let app, auth, db, provider, appleProvider, appName = 'BingOnline';
const DISABLED_MSG = "Tu cuenta ha sido deshabilitada, Motivado posiblemente a que has incumplido una o más clausulas en nuestros Terminos y condiciones. Contacta con un administrador del sistema si necesitas información.";
let firebaseInitPromise = null;
let firebaseConfigLoadPromise = null;
const nativeAlert = hasWindow() ? window.alert.bind(window) : null;
const nativeConfirm = hasWindow() ? window.confirm.bind(window) : null;
const nativePrompt = hasWindow() ? window.prompt.bind(window) : null;

function hasWindow(){
  return typeof window !== 'undefined';
}

function getConfigFromWindow(){
  if(!hasWindow()) return null;
  const cfg = window.firebaseConfig || window.__FIREBASE_CONFIG__;
  if(cfg && Object.keys(cfg).length > 0) return cfg;
  return null;
}

function ensureFirebaseConfigScript(){
  if(!hasWindow()) return Promise.resolve();
  if(getConfigFromWindow()) return Promise.resolve();
  if(!firebaseConfigLoadPromise){
    firebaseConfigLoadPromise = new Promise((resolve, reject)=>{
      if(typeof document === 'undefined'){
        resolve();
        return;
      }
      const existing = document.querySelector('script[data-firebase-config]');
      if(existing){
        if(getConfigFromWindow()){
          resolve();
          return;
        }
        existing.addEventListener('load', ()=>resolve(), { once: true });
        existing.addEventListener('error', ()=>reject(new Error('No se pudo cargar firebase-config.js')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'firebase-config.js';
      script.async = false;
      script.dataset.firebaseConfig = 'true';
      script.onload = ()=>resolve();
      script.onerror = ()=>reject(new Error('No se pudo cargar firebase-config.js'));
      document.head.appendChild(script);
    });
  }
  return firebaseConfigLoadPromise;
}

async function initFirebase(){
  if(app) return app;
  if(firebaseInitPromise) return firebaseInitPromise;

  firebaseInitPromise = (async ()=>{
    if(typeof firebase === 'undefined'){
      throw new Error('Firebase SDK no disponible.');
    }
    try{
      await ensureFirebaseConfigScript();
    }catch(loadErr){
      console.error('No se pudo cargar firebase-config.js', loadErr);
      throw loadErr;
    }

    const firebaseConfig = getConfigFromWindow();
    if (!firebaseConfig) {
      throw new Error('Firebase config no disponible. Genere public/firebase-config.js antes de cargar auth.js.');
    }
    app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);

    db = firebase.firestore();
    auth = firebase.auth();
    provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    appleProvider = new firebase.auth.OAuthProvider('apple.com');
    appleProvider.addScope('email');
    appleProvider.addScope('name');
    await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
    return app;
  })();

  return firebaseInitPromise;
}

initFirebase()
  .then(() => initAppName())
  .catch(e => {
    console.error('No se pudo inicializar Firebase al cargar auth.js', e);
  });
overrideDialogs();

async function initAppName(){
  try{
    await initFirebase();
  }catch(e){
    return;
  }
  try{
    const doc = await db.collection('Variablesglobales').doc('Parametros').get();
    if(doc.exists && doc.data().Aplicacion){
      appName = doc.data().Aplicacion;
    }
  }catch(e){
    console.error('Error obteniendo nombre de la app', e);
  }
}

function overrideDialogs(){
  if(!hasWindow() || typeof document === 'undefined') return;
  window.nativeDialogs = {
    alert: nativeAlert,
    confirm: nativeConfirm,
    prompt: nativePrompt
  };

  const ensureStyles = () => {
    if(document.getElementById('global-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'global-dialog-styles';
    style.textContent = `
      .global-dialog-overlay{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);z-index:12000;padding:16px;}
      .global-dialog-card{background:#0f172a;color:#e2e8f0;border-radius:16px;box-shadow:0 20px 45px rgba(0,0,0,0.35);width:min(480px,100%);border:1px solid #334155;overflow:hidden;font-family:'Poppins',sans-serif;}
      .global-dialog-header{background:linear-gradient(135deg,#9333ea,#2563eb);padding:14px 18px;color:#fff;display:flex;align-items:center;gap:10px;}
      .global-dialog-header h3{margin:0;font-size:1.1rem;letter-spacing:0.02em;}
      .global-dialog-body{padding:18px;font-size:0.95rem;line-height:1.5;color:#cbd5e1;}
      .global-dialog-body p{margin:0;white-space:pre-wrap;}
      .global-dialog-input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #334155;background:#0b1224;color:#e2e8f0;margin-top:12px;font-size:0.95rem;box-sizing:border-box;}
      .global-dialog-actions{display:flex;justify-content:flex-end;gap:10px;padding:0 18px 16px;}
      .global-dialog-btn{border:none;border-radius:999px;padding:10px 16px;font-weight:600;font-size:0.95rem;cursor:pointer;transition:transform 0.15s ease,box-shadow 0.15s ease;}
      .global-dialog-btn:focus{outline:2px solid #a855f7;outline-offset:2px;}
      .global-dialog-btn.primary{background:linear-gradient(135deg,#22c55e,#16a34a);color:#0b1224;box-shadow:0 10px 25px rgba(34,197,94,0.35);}
      .global-dialog-btn.secondary{background:#1f2937;color:#e2e8f0;border:1px solid #334155;}
      .global-dialog-btn:hover{transform:translateY(-1px);}
      @media (max-width:480px){.global-dialog-card{border-radius:12px;}.global-dialog-header{padding:12px 14px;}.global-dialog-actions{padding:0 14px 12px;}}
    `;
    document.head.appendChild(style);
  };

  const ensureDialog = () => {
    ensureStyles();
    let overlay = document.querySelector('.global-dialog-overlay');
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'global-dialog-overlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');

    const card = document.createElement('div');
    card.className = 'global-dialog-card';

    const header = document.createElement('div');
    header.className = 'global-dialog-header';
    const titleEl = document.createElement('h3');
    header.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'global-dialog-body';
    const messageEl = document.createElement('p');
    const inputEl = document.createElement('input');
    inputEl.className = 'global-dialog-input';
    inputEl.type = 'text';
    inputEl.style.display = 'none';
    body.appendChild(messageEl);
    body.appendChild(inputEl);

    const actions = document.createElement('div');
    actions.className = 'global-dialog-actions';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'global-dialog-btn secondary';
    cancelBtn.textContent = 'Cancelar';
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'global-dialog-btn primary';
    acceptBtn.textContent = 'Aceptar';
    actions.appendChild(cancelBtn);
    actions.appendChild(acceptBtn);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    return overlay;
  };

  const showDialog = (options) => {
    const {
      message = '',
      type = 'alert',
      placeholder = 'Escribe tu respuesta',
      defaultValue = '',
      acceptText = 'Aceptar',
      cancelText = 'Cancelar',
      title = appName
    } = options;

    const overlay = ensureDialog();
    if(!overlay){
      const fallback = type === 'confirm' ? nativeConfirm : type === 'prompt' ? nativePrompt : nativeAlert;
      return Promise.resolve(fallback ? fallback(message) : undefined);
    }

    const card = overlay.querySelector('.global-dialog-card');
    const titleEl = overlay.querySelector('.global-dialog-header h3');
    const messageEl = overlay.querySelector('.global-dialog-body p');
    const inputEl = overlay.querySelector('.global-dialog-input');
    const [cancelBtn, acceptBtn] = overlay.querySelectorAll('.global-dialog-btn');

    titleEl.textContent = title || appName;
    messageEl.textContent = message;
    acceptBtn.textContent = acceptText;
    cancelBtn.textContent = cancelText;
    inputEl.style.display = type === 'prompt' ? 'block' : 'none';
    inputEl.value = defaultValue || '';
    inputEl.placeholder = placeholder;
    cancelBtn.style.display = type === 'alert' ? 'none' : 'inline-flex';
    overlay.style.display = 'flex';
    overlay.dataset.type = type;
    overlay.focus();

    const focusTarget = type === 'prompt' ? inputEl : (type === 'alert' ? acceptBtn : cancelBtn);
    setTimeout(()=>{ focusTarget.focus(); }, 30);

    return new Promise(resolve => {
      const cleanup = () => {
        overlay.style.display = 'none';
        overlay.dataset.type = '';
        overlay.onclick = null;
        document.removeEventListener('keydown', onKeyDown);
        acceptBtn.onclick = null;
        cancelBtn.onclick = null;
      };

      const close = (value) => {
        cleanup();
        resolve(value);
      };

      const onKeyDown = (ev) => {
        if(ev.key === 'Escape'){
          ev.preventDefault();
          if(type === 'alert') close(undefined);
          else close(type === 'prompt' ? null : false);
        }
        if(ev.key === 'Enter'){
          if(document.activeElement === cancelBtn) return;
          ev.preventDefault();
          acceptBtn.click();
        }
      };

      overlay.onclick = (e)=>{ if(e.target === overlay) close(type === 'alert' ? undefined : type === 'prompt' ? null : false); };
      acceptBtn.onclick = ()=>{ const val = type === 'prompt' ? inputEl.value : true; close(val); };
      cancelBtn.onclick = ()=> close(type === 'prompt' ? null : false);
      document.addEventListener('keydown', onKeyDown);
    }).then(val => {
      if(type === 'confirm') return !!val;
      if(type === 'alert') return undefined;
      return val;
    });
  };

  window.alert = (message) => showDialog({ message, type: 'alert' });
  window.confirm = (message) => showDialog({ message, type: 'confirm' });
  window.prompt = (message, def = '') => showDialog({ message, type: 'prompt', defaultValue: def });
  window.modalDialogs = { alert: window.alert, confirm: window.confirm, prompt: window.prompt };
}

async function loginGoogle(){
  try {
    await initFirebase();
  } catch(initErr){
    console.error('No se pudo inicializar Firebase', initErr);
    alert('Error de inicialización de Firebase');
    return;
  }
  try {
    if(provider && provider.setCustomParameters){
      provider.setCustomParameters({ prompt: 'select_account' });
    }
    await auth.signInWithPopup(provider);
  } catch(err) {
    if (err.code === 'auth/user-disabled') {
      alert(DISABLED_MSG);
      return;
    }
    console.warn('Popup login failed, trying redirect', err);
    try {
      await auth.signInWithRedirect(provider);
    } catch(e){
      if (e.code === 'auth/user-disabled') {
        alert(DISABLED_MSG);
      } else if (e.code === 'auth/web-storage-unsupported') {
        alert('El navegador ha bloqueado las cookies necesarias para continuar. Intenta habilitarlas o abre la aplicación desde un dominio configurado en Firebase.');
      } else {
        console.error('Error login Google', e);
        alert('Error al iniciar sesión con Google');
      }
    }
  }
}

async function loginApple(){
  try {
    await initFirebase();
  } catch(initErr){
    console.error('No se pudo inicializar Firebase', initErr);
    alert('Error de inicialización de Firebase');
    return;
  }
  try{
    await auth.signInWithPopup(appleProvider);
  }catch(err){
    if (err.code === 'auth/user-disabled') {
      alert(DISABLED_MSG);
      return;
    }
    console.warn('Popup login failed, trying redirect', err);
    try{
      await auth.signInWithRedirect(appleProvider);
    }catch(e){
      if (e.code === 'auth/user-disabled') {
        alert(DISABLED_MSG);
      } else if (e.code === 'auth/web-storage-unsupported') {
        alert('El navegador ha bloqueado las cookies necesarias para continuar. Intenta habilitarlas o abre la aplicación desde un dominio configurado en Firebase.');
      } else {
        console.error('Error login Apple', e);
        alert('Error al iniciar sesión con Apple');
      }
    }
  }
}

function logout(){
  auth.signOut();
}

async function handleRedirect(){
  try {
    await initFirebase();
  }catch(initErr){
    console.error('No se pudo inicializar Firebase al procesar el inicio de sesión con redirección', initErr);
    return;
  }
  try {
    const result = await auth.getRedirectResult();
    if(result.user){
      const { role, exists } = await getUserRole(result.user, { createIfMissing: false });
      if(!exists && role === 'Jugador'){
        window.location.href = 'registrarse.html';
        return;
      }
      redirectByRole(role);
    }
  } catch(err){
    if (err.code === 'auth/web-storage-unsupported') {
      alert('El navegador impide usar el almacenamiento necesario para mantener la sesión. Abre la aplicación desde un dominio configurado en Firebase o habilita las cookies.');
    }
    console.error('Error processing redirect login', err);
  }
}

async function getUserRole(user, options = {}){
  const {
    createIfMissing = false,
    autoCreateRoles = ['Colaborador', 'Administrador', 'Superadmin']
  } = options;
  try{
    await initFirebase();
  }catch(e){
    console.error('No se pudo inicializar Firebase al obtener el rol de usuario', e);
    throw e;
  }
  let persistentRole = null;
  try{
    const rolesSnap = await db.collection('roles').get();
    rolesSnap.forEach(doc => {
      const emails = doc.data().emails || [];
      if(emails.includes(user.email)) persistentRole = doc.id;
    });
  }catch(e){
    console.error('Error checking roles', e);
  }
  const ref = db.collection('users').doc(user.email);
  const doc = await ref.get();
  if(!doc.exists){
    const role = persistentRole || 'Jugador';
    let recordExists = false;
    if(role !== 'Jugador' && (createIfMissing || autoCreateRoles.includes(role))){
      const baseData = { email: user.email, role, aceptoNotificaciones: 'NO' };
      if(user.photoURL){
        baseData.photoURL = user.photoURL;
      }
      await ref.set(baseData, { merge: true });
      recordExists = true;
    }
    return { role, exists: recordExists };
  }
  const data = doc.data() || {};
  const dataRole = data.role || 'Jugador';
  let finalRole = persistentRole || dataRole;
  if(persistentRole && dataRole !== persistentRole){
    await ref.update({ role: persistentRole });
    finalRole = persistentRole;
  }
  return { role: finalRole, exists: true };
}

function redirectByRole(role){
  switch(role){
    case 'Colaborador':
      window.location.href = 'collab.html';
      break;
    case 'Administrador':
      window.location.href = 'admin.html';
      break;
    case 'Superadmin':
      window.location.href = 'super.html';
      break;
    default:
      window.location.href = 'player.html';
  }
}

function setupSuperadminExit(buttonSelector = '#salir-super-btn', redirect = 'super.html'){
  if(!hasWindow()) return;
  initFirebase()
    .then(()=>{
      const button = typeof buttonSelector === 'string' ? document.querySelector(buttonSelector) : buttonSelector;
      if(!button) return;
      if(button.dataset.superExitReady === 'true') return;
      button.dataset.superExitReady = 'true';
      const bindRedirect = ()=>{
        if(button.dataset.superExitBound === 'true') return;
        button.addEventListener('click', ()=>{ window.location.href = redirect; });
        button.dataset.superExitBound = 'true';
      };
      auth.onAuthStateChanged(async user=>{
        if(!user){
          button.style.display = 'none';
          return;
        }
        try{
          const { role } = await getUserRole(user, { createIfMissing: false });
          if(role === 'Superadmin'){
            bindRedirect();
            button.style.display = 'flex';
            button.style.backgroundColor = '#d32f2f';
            button.style.borderColor = 'orange';
          }else{
            button.style.display = 'none';
          }
        }catch(err){
          console.error('No se pudo determinar si el usuario es Superadmin', err);
        }
      });
    })
    .catch(err=>{
      console.error('No se pudo configurar el botón de retorno a Superadmin', err);
    });
}

function ensureAuth(roleExpected){
  const rolesEsperados = Array.isArray(roleExpected) ? roleExpected : (roleExpected ? [roleExpected] : []);
  initFirebase()
    .then(() => {
      auth.onAuthStateChanged(async user => {
        if(!user){
          if(window.notificationCenter && typeof window.notificationCenter.desvincularUsuario === 'function'){
            try{ window.notificationCenter.desvincularUsuario(); }
            catch(err){ console.error('No se pudo desvincular el centro de notificaciones', err); }
          }
          window.location.href='index.html';
          return;
        }
        const { role, exists } = await getUserRole(user, { createIfMissing: false });
        if(!exists && role === 'Jugador'){
          window.location.href = 'registrarse.html';
          return;
        }
        if(rolesEsperados.length && !rolesEsperados.includes(role) && role !== 'Superadmin'){
          redirectByRole(role);
          return;
        }
        window.currentRole = role;
        const nombreVisible = (user.displayName && user.displayName.trim()) ? user.displayName : (user.email || '');
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = nombreVisible;
        const emailEl = document.getElementById('user-email');
        if (emailEl) emailEl.textContent = user.email;
        const picEl = document.getElementById('user-pic');
        if (picEl) {
          if (typeof asignarFotoUsuario === 'function') {
            asignarFotoUsuario(picEl, user.photoURL || '');
          } else {
            picEl.src = user.photoURL || picEl.src;
          }
        }
        const infoEl = document.getElementById('session-info');
        if (infoEl) infoEl.style.display = 'flex';
        const logoutEl = document.getElementById('logout-link');
        if (logoutEl) {
          logoutEl.addEventListener('click', e => {
            e.preventDefault();
            logout();
          });
        }
        startUserStatusWatcher();
        if(window.notificationCenter && typeof window.notificationCenter.vincularUsuario === 'function'){
          try{ window.notificationCenter.vincularUsuario(user, role); }
          catch(err){ console.error('No se pudo vincular el centro de notificaciones', err); }
        }
      });
    })
    .catch(err => {
      console.error('No se pudo iniciar la autenticación', err);
      alert('Error de inicialización de Firebase. Intente más tarde.');
      if(hasWindow()){
        window.location.href = 'index.html';
      }
    });
}

let statusWatcher = null;
function startUserStatusWatcher(){
  if(statusWatcher) return;
  statusWatcher = setInterval(async ()=>{
    const u = auth.currentUser;
    if(!u) return;
    try{
      await u.reload();
    }catch(e){
      if(e.code === 'auth/user-disabled'){
        alert(DISABLED_MSG);
        logout();
      }
    }
  },60000);
}

const PWA_DISMISS_KEY = 'pwaInstallDismissUntil';
const PWA_INSTALLED_KEY = 'pwaInstalled';
let deferredInstallPrompt = null;
let pwaPromptScheduled = false;
let pwaModalOpen = false;

function isIosDevice(){
  if(!hasWindow() || !window.navigator) return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
}

function isMobileDevice(){
  if(!hasWindow() || !window.navigator) return false;
  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
}

function isStandaloneMode(){
  if(!hasWindow()) return false;
  const isStandaloneMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = window.navigator && window.navigator.standalone === true;
  return Boolean(isStandaloneMedia || isIosStandalone);
}

function markPwaInstalled(){
  if(!hasWindow() || !window.localStorage) return;
  window.localStorage.setItem(PWA_INSTALLED_KEY, 'true');
  window.pwaInstallStatus = { installed: true, checkedAt: new Date().toISOString() };
}

function readDismissUntil(){
  if(!hasWindow() || !window.localStorage) return null;
  const stored = window.localStorage.getItem(PWA_DISMISS_KEY);
  if(!stored) return null;
  const parsed = Number(stored);
  return Number.isFinite(parsed) ? parsed : null;
}

function dismissInstallPrompt(days = 7){
  if(!hasWindow() || !window.localStorage) return;
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  window.localStorage.setItem(PWA_DISMISS_KEY, String(until));
}

async function hasRelatedInstalledApps(){
  if(!hasWindow() || !window.navigator || typeof window.navigator.getInstalledRelatedApps !== 'function'){
    return false;
  }
  try{
    const apps = await window.navigator.getInstalledRelatedApps();
    return Array.isArray(apps) && apps.length > 0;
  }catch(err){
    console.warn('No se pudo consultar getInstalledRelatedApps', err);
    return false;
  }
}

function ensurePwaMetaAssets(){
  if(typeof document === 'undefined') return;
  if(!document.querySelector('link[rel="manifest"]')){
    const manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    manifestLink.href = '/manifest.webmanifest';
    document.head.appendChild(manifestLink);
  }
  if(!document.querySelector('meta[name="theme-color"]')){
    const themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    themeColor.content = '#0b1b4d';
    document.head.appendChild(themeColor);
  }
  if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){
    const appleCapable = document.createElement('meta');
    appleCapable.name = 'apple-mobile-web-app-capable';
    appleCapable.content = 'yes';
    document.head.appendChild(appleCapable);
  }
  if(!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')){
    const appleStatus = document.createElement('meta');
    appleStatus.name = 'apple-mobile-web-app-status-bar-style';
    appleStatus.content = 'black-translucent';
    document.head.appendChild(appleStatus);
  }
}

function ensurePwaModalStyles(){
  if(typeof document === 'undefined') return;
  if(document.getElementById('pwa-install-styles')) return;
  const style = document.createElement('style');
  style.id = 'pwa-install-styles';
  style.textContent = `
    .pwa-install-overlay{
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(15, 23, 42, 0.2);
      z-index: 9999;
      padding: 24px;
    }
    .pwa-install-card{
      width: min(360px, 100%);
      background: #fdf7ff;
      border-radius: 18px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.16);
      border: 1px solid rgba(148, 163, 184, 0.35);
      overflow: hidden;
      font-family: "Poppins", "Segoe UI", sans-serif;
      color: #1f2937;
    }
    .pwa-install-header{
      background: linear-gradient(135deg, #dbeafe, #ede9fe);
      padding: 16px 20px;
      font-size: 16px;
      font-weight: 600;
      color: #4c1d95;
    }
    .pwa-install-body{
      padding: 16px 20px 4px;
      font-size: 14px;
      line-height: 1.5;
      color: #334155;
    }
    .pwa-install-body ul{
      margin: 8px 0 0 18px;
      padding: 0;
    }
    .pwa-install-actions{
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      padding: 16px 20px 20px;
    }
    .pwa-install-button{
      border: none;
      border-radius: 999px;
      padding: 10px 18px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .pwa-install-button:active{
      transform: scale(0.98);
    }
    .pwa-install-cancel{
      background: #e2e8f0;
      color: #475569;
    }
    .pwa-install-confirm{
      background: linear-gradient(135deg, #4ade80, #22c55e);
      color: #f8fafc;
      box-shadow: 0 8px 18px rgba(34, 197, 94, 0.35);
    }
  `;
  document.head.appendChild(style);
}

function showInstallModal({
  title,
  message,
  list,
  confirmText = 'Aceptar',
  cancelText = 'Cancelar',
  showCancel = true,
  onConfirm,
  onCancel
}){
  if(typeof document === 'undefined' || pwaModalOpen) return Promise.resolve(false);
  pwaModalOpen = true;
  ensurePwaModalStyles();
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'pwa-install-overlay';

    const card = document.createElement('div');
    card.className = 'pwa-install-card';

    const header = document.createElement('div');
    header.className = 'pwa-install-header';
    header.textContent = title;

    const body = document.createElement('div');
    body.className = 'pwa-install-body';
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    body.appendChild(messageEl);

    if(Array.isArray(list) && list.length){
      const ul = document.createElement('ul');
      list.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      });
      body.appendChild(ul);
    }

    const actions = document.createElement('div');
    actions.className = 'pwa-install-actions';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'pwa-install-button pwa-install-confirm';
    confirmBtn.textContent = confirmText;

    const closeModal = () => {
      overlay.remove();
      pwaModalOpen = false;
    };

    confirmBtn.addEventListener('click', () => {
      if(typeof onConfirm === 'function'){
        onConfirm();
      }
      closeModal();
      resolve(true);
    });

    actions.appendChild(confirmBtn);

    if(showCancel){
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'pwa-install-button pwa-install-cancel';
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener('click', () => {
        if(typeof onCancel === 'function'){
          onCancel();
        }
        closeModal();
        resolve(false);
      });
      actions.prepend(cancelBtn);
    }

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

function shouldOfferInstall(){
  if(!hasWindow()) return false;
  if(!isMobileDevice()) return false;
  if(isStandaloneMode()) return false;
  if(window.localStorage && window.localStorage.getItem(PWA_INSTALLED_KEY) === 'true') return false;
  const dismissUntil = readDismissUntil();
  if(dismissUntil && Date.now() < dismissUntil) return false;
  return true;
}

async function showIosInstallInstructions(){
  const accepted = await showInstallModal({
    title: 'Bingo Online',
    message: '¿Quieres instalar Bingo Online en tu pantalla principal?',
    confirmText: 'Continuar',
    cancelText: 'Ahora no'
  });
  if(!accepted){
    dismissInstallPrompt();
    return;
  }
  await showInstallModal({
    title: 'Instalación en iOS',
    message: 'Sigue estos pasos en Safari para agregar el acceso directo:',
    list: [
      'Abre el menú de compartir (ícono de cuadro con flecha).',
      'Selecciona "Agregar a pantalla de inicio".',
      'Confirma el nombre y toca "Agregar".'
    ],
    confirmText: 'Entendido',
    showCancel: false
  });
}

async function showAndroidInstallPrompt(){
  if(!deferredInstallPrompt) return;
  const accepted = await showInstallModal({
    title: 'Bingo Online',
    message: '¿Deseas instalar Bingo Online como acceso directo?',
    confirmText: 'Instalar',
    cancelText: 'Cancelar',
    onConfirm: () => {
      try{
        deferredInstallPrompt.prompt();
      }catch(err){
        console.warn('No se pudo lanzar el instalador de la app', err);
      }
    }
  });
  if(!accepted){
    dismissInstallPrompt();
    return;
  }
  try{
    const choice = await deferredInstallPrompt.userChoice;
    if(choice && choice.outcome !== 'accepted'){
      dismissInstallPrompt();
    }else{
      markPwaInstalled();
    }
  }catch(err){
    console.warn('No se pudo completar la solicitud de instalación', err);
  }
  deferredInstallPrompt = null;
}

async function tryPromptPwaInstall(){
  if(!shouldOfferInstall()) return;
  const installedRelated = await hasRelatedInstalledApps();
  if(installedRelated){
    markPwaInstalled();
    return;
  }
  if(isIosDevice()){
    await showIosInstallInstructions();
    return;
  }
  if(deferredInstallPrompt){
    await showAndroidInstallPrompt();
  }
}

function schedulePwaPrompt(){
  if(pwaPromptScheduled) return;
  pwaPromptScheduled = true;
  setTimeout(() => {
    tryPromptPwaInstall().finally(() => {
      pwaPromptScheduled = false;
    });
  }, 1500);
}

function initPwaInstallFlow(){
  if(!hasWindow()) return;
  if(window.__pwaInstallFlowInitialized) return;
  window.__pwaInstallFlowInitialized = true;

  ensurePwaMetaAssets();
  window.pwaInstallStatus = { installed: isStandaloneMode(), checkedAt: new Date().toISOString() };

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('No se pudo registrar el service worker', err);
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    schedulePwaPrompt();
  });

  window.addEventListener('appinstalled', () => {
    markPwaInstalled();
  });

  schedulePwaPrompt();
}

if(hasWindow()){
  if(document.readyState === 'complete' || document.readyState === 'interactive'){
    initPwaInstallFlow();
  }else{
    window.addEventListener('DOMContentLoaded', initPwaInstallFlow, { once: true });
  }
}

if (typeof module !== "undefined") { module.exports = { redirectByRole, ensureAuth, setupSuperadminExit }; }
