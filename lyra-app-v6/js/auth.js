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

// Estado de autenticación
let currentUser = null;
let authStateCallback = null;

/**
 * Inicializa el listener de autenticación
 * @param {Function} callback - Función que se ejecuta cuando cambia el estado de auth
 */
export function initAuthListener(callback) {
  authStateCallback = callback;
  
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Usuario autenticado
      currentUser = user;
      
      // Obtener datos adicionales del usuario desde Firestore
      const userDocRef = doc(db, 'usuarios', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        currentUser.data = userDoc.data();
      } else {
        currentUser.data = {};
      }
      
      if (authStateCallback) {
        authStateCallback(true, currentUser);
      }
    } else {
      // Usuario no autenticado
      currentUser = null;
      if (authStateCallback) {
        authStateCallback(false, null);
      }
    }
  });
}

/**
 * Registra un nuevo usuario
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña (mínimo 6 caracteres)
 * @param {string} nombre - Nombre completo del usuario
 * @param {string} hotel - Nombre del hotel/centro
 * @returns {Promise<Object>} Resultado del registro
 */
export async function registerUser(email, password, nombre, hotel) {
  try {
    // Validaciones
    if (!email || !password || !nombre || !hotel) {
      throw new Error('Todos los campos son obligatorios');
    }
    
    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    
    if (!validateEmail(email)) {
      throw new Error('Email no válido');
    }
    
    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Actualizar perfil con el nombre
    await updateProfile(user, {
      displayName: nombre
    });
    
    // Crear documento del usuario en Firestore
    const userData = {
      uid: user.uid,
      email: email,
      nombre: nombre,
      hotel: hotel,
      fechaRegistro: new Date().toISOString(),
      activo: true
    };
    
    await setDoc(doc(db, 'usuarios', user.uid), userData);
    
    currentUser = user;
    currentUser.data = userData;
    
    return {
      success: true,
      user: currentUser,
      message: 'Registro completado correctamente'
    };
    
  } catch (error) {
    console.error('Error en registro:', error);
    
    let mensajeError = 'Error al registrar usuario';
    
    if (error.code === 'auth/email-already-in-use') {
      mensajeError = 'Este email ya está registrado';
    } else if (error.code === 'auth/invalid-email') {
      mensajeError = 'Email no válido';
    } else if (error.code === 'auth/weak-password') {
      mensajeError = 'La contraseña es demasiado débil';
    } else if (error.message) {
      mensajeError = error.message;
    }
    
    return {
      success: false,
      error: mensajeError
    };
  }
}

/**
 * Inicia sesión de un usuario existente
 * @param {string} email - Email del usuario
 * @param {string} password - Contraseña
 * @returns {Promise<Object>} Resultado del login
 */
export async function loginUser(email, password) {
  try {
    // Validaciones
    if (!email || !password) {
      throw new Error('Email y contraseña son obligatorios');
    }
    
    // Iniciar sesión en Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Obtener datos del usuario desde Firestore
    const userDocRef = doc(db, 'usuarios', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      currentUser = user;
      currentUser.data = userDoc.data();
      
      // Verificar si el usuario está activo
      if (currentUser.data.activo === false) {
        await signOut(auth);
        throw new Error('Tu cuenta ha sido desactivada. Contacta con el administrador.');
      }
      
      return {
        success: true,
        user: currentUser,
        message: 'Sesión iniciada correctamente'
      };
    } else {
      // Si no existe el documento, crearlo con datos básicos
      const userData = {
        uid: user.uid,
        email: user.email,
        nombre: user.displayName || 'Usuario',
        hotel: 'Mi Hotel',
        fechaRegistro: new Date().toISOString(),
        activo: true
      };
      
      await setDoc(doc(db, 'usuarios', user.uid), userData);
      
      currentUser = user;
      currentUser.data = userData;
      
      return {
        success: true,
        user: currentUser,
        message: 'Sesión iniciada correctamente'
      };
    }
    
  } catch (error) {
    console.error('Error en login:', error);
    
    let mensajeError = 'Error al iniciar sesión';
    
    if (error.code === 'auth/user-not-found') {
      mensajeError = 'Usuario no encontrado';
    } else if (error.code === 'auth/wrong-password') {
      mensajeError = 'Contraseña incorrecta';
    } else if (error.code === 'auth/invalid-email') {
      mensajeError = 'Email no válido';
    } else if (error.code === 'auth/invalid-credential') {
      mensajeError = 'Credenciales inválidas';
    } else if (error.message) {
      mensajeError = error.message;
    }
    
    return {
      success: false,
      error: mensajeError
    };
  }
}

/**
 * Cierra la sesión del usuario actual
 * @returns {Promise<Object>} Resultado del logout
 */
export async function logoutUser() {
  try {
    await signOut(auth);
    currentUser = null;
    
    return {
      success: true,
      message: 'Sesión cerrada correctamente'
    };
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
    return {
      success: false,
      error: 'Error al cerrar sesión'
    };
  }
}

/**
 * Obtiene el usuario actual
 * @returns {Object|null} Usuario actual o null
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Verifica si hay un usuario autenticado
 * @returns {boolean} True si hay usuario autenticado
 */
export function isAuthenticated() {
  return currentUser !== null;
}

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {boolean} True si es válido
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Actualiza los datos del usuario en Firestore
 * @param {Object} data - Datos a actualizar
 * @returns {Promise<Object>} Resultado de la actualización
 */
export async function updateUserData(data) {
  try {
    if (!currentUser) {
      throw new Error('No hay usuario autenticado');
    }
    
    const userDocRef = doc(db, 'usuarios', currentUser.uid);
    await setDoc(userDocRef, data, { merge: true });
    
    // Actualizar estado local
    currentUser.data = { ...currentUser.data, ...data };
    
    return {
      success: true,
      message: 'Datos actualizados correctamente'
    };
  } catch (error) {
    console.error('Error al actualizar datos:', error);
    return {
      success: false,
      error: 'Error al actualizar datos'
    };
  }
}