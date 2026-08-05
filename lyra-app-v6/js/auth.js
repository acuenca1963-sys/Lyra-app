// lyra-app-v6/js/auth.js
import { auth, db } from './firebase.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let authStateCallback = null;

export function initAuthListener(callback) {
  authStateCallback = callback;
  
  onAuthStateChanged(auth, async (user) => {
    try {
      if (user) {
        currentUser = user;
        const userDocRef = doc(db, 'usuarios', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          currentUser.data = userDoc.data();
        } else {
          currentUser.data = {};
        }
        
        if (authStateCallback) authStateCallback(true, currentUser);
      } else {
        currentUser = null;
        if (authStateCallback) authStateCallback(false, null);
      }
    } catch (error) {
      console.error('🔥 Error crítico en initAuthListener:', error);
      if (authStateCallback) authStateCallback(false, null);
    }
  });
}

export async function registerUser(email, password, nombre, hotel) {
  try {
    const emailLimpio = email.trim().toLowerCase();
    const passLimpio = password.trim();
    
    if (!emailLimpio || !passLimpio || !nombre || !hotel) throw new Error('Todos los campos son obligatorios');
    if (passLimpio.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');
    
    const userCredential = await createUserWithEmailAndPassword(auth, emailLimpio, passLimpio);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName: nombre });
    
    const userData = {
      uid: user.uid, email: emailLimpio, nombre, hotel,
      fechaRegistro: new Date().toISOString(), activo: true
    };
    
    await setDoc(doc(db, 'usuarios', user.uid), userData);
    currentUser = user;
    currentUser.data = userData;
    
    return { success: true, user: currentUser, message: 'Registro completado' };
  } catch (error) {
    console.error('Error en registro:', error);
    let msg = 'Error al registrar usuario';
    if (error.code === 'auth/email-already-in-use') msg = 'Este email ya está registrado';
    else if (error.code === 'auth/weak-password') msg = 'La contraseña es demasiado débil (mín. 6 caracteres)';
    else if (error.message) msg = error.message;
    
    return { success: false, error: msg };
  }
}

export async function loginUser(email, password) {
  try {
    // 🛡️ BLINDAJE TOTAL: Elimina espacios y fuerza minúsculas aquí, pase lo que pase en el móvil
    const emailLimpio = email.trim().toLowerCase();
    const passLimpio = password.trim();
    
    if (!emailLimpio || !passLimpio) throw new Error('Email y contraseña son obligatorios');
    
    const userCredential = await signInWithEmailAndPassword(auth, emailLimpio, passLimpio);
    const user = userCredential.user;
    
    const userDocRef = doc(db, 'usuarios', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      currentUser = user;
      currentUser.data = userDoc.data();
      
      if (currentUser.data.activo === false) {
        await signOut(auth);
        throw new Error('Tu cuenta ha sido desactivada. Contacta con el administrador.');
      }
      
      return { success: true, user: currentUser, message: 'Sesión iniciada' };
    } else {
      const userData = {
        uid: user.uid, email: user.email, nombre: user.displayName || 'Usuario',
        hotel: 'Mi Hotel', fechaRegistro: new Date().toISOString(), activo: true
      };
      await setDoc(doc(db, 'usuarios', user.uid), userData);
      currentUser = user;
      currentUser.data = userData;
      
      return { success: true, user: currentUser, message: 'Sesión iniciada' };
    }
  } catch (error) {
    console.error('🔥 Error en login:', error);
    let msg = 'Error al iniciar sesión';
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      msg = 'Email o contraseña incorrectos';
    } else if (error.message) {
      msg = error.message;
    }
    
    return { success: false, error: msg };
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
    currentUser = null;
    return { success: true, message: 'Sesión cerrada' };
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return { success: false, error: 'Error al cerrar sesión' };
  }
}

export function getCurrentUser() { return currentUser; }
export function isAuthenticated() { return currentUser !== null; }

export async function updateUserData(data) {
  try {
    if (!currentUser) throw new Error('No hay usuario autenticado');
    const userDocRef = doc(db, 'usuarios', currentUser.uid);
    await setDoc(userDocRef, data, { merge: true });
    currentUser.data = { ...currentUser.data, ...data };
    return { success: true, message: 'Datos actualizados' };
  } catch (error) {
    console.error('Error al actualizar datos:', error);
    return { success: false, error: 'Error al actualizar datos' };
  }
}