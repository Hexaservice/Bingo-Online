let app, auth, db, provider, appName = 'BingOnline';
const DISABLED_MSG = "Tu cuenta ha sido deshabilitada, Motivado posiblemente a que has incumplido una o más clausulas en nuestros Terminos y condiciones. Contacta con un administrador del sistema si necesitas información.";
let firebaseInitPromise = null;
let firebaseConfigLoadPromise = null;

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
  const createOverlay = message => {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';

    const box = document.createElement('div');
    box.style.background = '#fff';
    box.style.padding = '20px';
    box.style.borderRadius = '10px';
    box.style.textAlign = 'center';
    box.style.maxWidth = '80%';
    box.style.fontFamily = 'Calibri, Arial, sans-serif';

    const title = document.createElement('h3');
    title.textContent = appName;
    title.style.marginTop = '0';

    const msg = document.createElement('p');
    msg.textContent = message;

    box.appendChild(title);
    box.appendChild(msg);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    return { overlay, box };
  };

  window.alert = function(message){
    const { overlay, box } = createOverlay(message);
    const btn = document.createElement('button');
    btn.textContent = 'Aceptar';
    btn.style.marginTop = '10px';
    btn.addEventListener('click', () => overlay.remove());
    box.appendChild(btn);
  };

  window.confirm = function(message){
    return new Promise(resolve => {
      const { overlay, box } = createOverlay(message);
      const btnOk = document.createElement('button');
      btnOk.textContent = 'Aceptar';
      btnOk.style.margin = '10px';
      btnOk.addEventListener('click', () => { overlay.remove(); resolve(true); });
      const btnCancel = document.createElement('button');
      btnCancel.textContent = 'Cancelar';
      btnCancel.style.margin = '10px';
      btnCancel.addEventListener('click', () => { overlay.remove(); resolve(false); });
      box.appendChild(btnOk);
      box.appendChild(btnCancel);
    });
  };

  window.prompt = function(message, def=''){
    return new Promise(resolve => {
      const { overlay, box } = createOverlay(message);
      const input = document.createElement('input');
      input.type = 'text';
      input.style.marginTop = '10px';
      input.value = def;
      const btnOk = document.createElement('button');
      btnOk.textContent = 'Aceptar';
      btnOk.style.margin = '10px';
      btnOk.addEventListener('click', () => { const val = input.value; overlay.remove(); resolve(val); });
      const btnCancel = document.createElement('button');
      btnCancel.textContent = 'Cancelar';
      btnCancel.style.margin = '10px';
      btnCancel.addEventListener('click', () => { overlay.remove(); resolve(null); });
      box.appendChild(input);
      box.appendChild(btnOk);
      box.appendChild(btnCancel);
      input.focus();
    });
  };
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
      const role = await getUserRole(result.user);
      redirectByRole(role);
    }
  } catch(err){
    if (err.code === 'auth/web-storage-unsupported') {
      alert('El navegador impide usar el almacenamiento necesario para mantener la sesión. Abre la aplicación desde un dominio configurado en Firebase o habilita las cookies.');
    }
    console.error('Error processing redirect login', err);
  }
}

async function getUserRole(user){
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
    await ref.set({ email:user.email, alias:user.displayName||user.email, role });
    return role;
  }
  const dataRole = doc.data().role || 'Jugador';
  if(persistentRole && dataRole !== persistentRole){
    await ref.update({ role: persistentRole });
    return persistentRole;
  }
  return persistentRole || dataRole;
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
          const role = await getUserRole(user);
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
  initFirebase()
    .then(() => {
      auth.onAuthStateChanged(async user => {
        if(!user){ window.location.href='index.html'; return; }
        const role = await getUserRole(user);
        if(roleExpected && role !== roleExpected && role !== 'Superadmin'){
          redirectByRole(role);
          return;
        }
        window.currentRole = role;
        const nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = user.displayName;
        const emailEl = document.getElementById('user-email');
        if (emailEl) emailEl.textContent = user.email;
        const picEl = document.getElementById('user-pic');
        if (picEl) picEl.src = user.photoURL;
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

if (typeof module !== "undefined") { module.exports = { redirectByRole, ensureAuth, setupSuperadminExit }; }
