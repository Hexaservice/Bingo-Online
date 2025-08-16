let app, auth, db, provider, appName = 'BingOnline';
const DISABLED_MSG = "Tu cuenta ha sido deshabilitada, Motivado posiblemente a que has incumplido una o más clausulas en nuestros Terminos y condiciones. Contacta con un administrador del sistema si necesitas información.";
function initFirebase(){
  const firebaseConfig = {
    apiKey: "AIzaSyBztIl46s-vOOxrUVDilJNSN6zuzldeUWI",
    authDomain: "bingo-online-231fd.firebaseapp.com",
    databaseURL: "https://bingo-online-231fd-default-rtdb.firebaseio.com",
    projectId: "bingo-online-231fd",
    storageBucket: "bingo-online-231fd.appspot.com",
    messagingSenderId: "455917034653",
    appId: "1:455917034653:web:ef3f7a1d14be86a1580874"
  };
  app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  provider = new firebase.auth.GoogleAuthProvider();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
}

initFirebase();
initAppName();
overrideDialogs();

async function initAppName(){
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
  if(!app){
    try{
      initFirebase();
    }catch(e){
      console.error('No se pudo inicializar Firebase', e);
      alert('Error de inicialización de Firebase');
      return;
    }
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

function ensureAuth(roleExpected){
  initFirebase();
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

if (typeof module !== "undefined") { module.exports = { redirectByRole, ensureAuth }; }
