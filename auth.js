let app, auth, db, provider;
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
  app = firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
  auth = firebase.auth();
  provider = new firebase.auth.GoogleAuthProvider();
}

function loginGoogle(){
  if(!document.getElementById('accept-terms').checked){
    alert('Debes aceptar los términos y condiciones');
    return;
  }
  auth.signInWithPopup(provider).catch(err => {
    console.error('Error login Google', err);
  });
}

function logout(){
  auth.signOut();
}

async function getUserRole(user){
  const predefinedRoles = {
    "jhoseph.q@gmail.com": "Superadmin",
    "hexaservice.co@gmail.com": "Colaborador"
  };
  const role = predefinedRoles[user.email];
  const ref = db.collection('users').doc(user.email);
  const doc = await ref.get();
  if(!doc.exists){
    if(role){
      await ref.set({ email:user.email, alias:user.displayName||user.email, role });
      return role;
    } else {
      await ref.set({ email:user.email, alias:user.displayName||user.email, role:'Jugador' });
      return 'Jugador';
    }
  }
  return doc.data().role || role || 'Jugador';
}

function redirectByRole(role){
  switch(role){
    case 'Superadmin': window.location.href='super.html'; break;
    case 'Administrador': window.location.href='admin.html'; break;
    case 'Colaborador': window.location.href='collab.html'; break;
    default: window.location.href='player.html';
  }
}

function ensureAuth(roleExpected){
  initFirebase();
  auth.onAuthStateChanged(async user => {
    if(!user){ window.location.href='index.html'; return; }
    const role = await getUserRole(user);
    if(roleExpected && role !== roleExpected){
      redirectByRole(role);
      return;
    }
    document.getElementById('user-name')?.textContent = user.displayName;
    document.getElementById('user-email')?.textContent = user.email;
    document.getElementById('logout-link')?.addEventListener('click', e => { e.preventDefault(); logout(); });
  });
}
