// ============================================
// Lyra App v6 - Configuración Firebase
// Archivo: js/firebase.js
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, deleteDoc, onSnapshot, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// 🔑 Configuración de Firebase (idéntica a la de v5.16)
const firebaseConfig = {
    apiKey: "AIzaSyD7s6NWf8wM0Ie2s8Ax0u_TTUxvq01U5NY",
    authDomain: "elantkan-gestion.firebaseapp.com",
    projectId: "elantkan-gestion",
    storageBucket: "elantkan-gestion.firebasestorage.app",
    messagingSenderId: "312564681109",
    appId: "1:312564681109:web:4b1417579d481846380e9c"
};

// 🚀 Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 🌐 Variables globales de la app
let currentUser = null;
let perrosDB = [];
let reservasDB = [];
let facturasDB = [];
let trainingDB = [];
let calendarDate = new Date();
let trainingCalendarDate = new Date();
let contactosSeleccionados = [];
let facturasSeleccionadas = [];
let fotoActualBase64 = null;
let fotoEditBase64 = null;
let perrosGrupoReserva = [];
let reservaEditActual = null;
let clientLogoBase64 = null;
let currentConfig = null;
let isGeneratingInvoice = false;

const LOGO_URL_LYRA = "https://raw.githubusercontent.com/acuenca1963-sys/Lyra-app/main/logo-lyra.png";

//  Exportar todo lo que necesitan los demás módulos
export {
    auth,
    db,
    storage,
    LOGO_URL_LYRA,
    firebaseConfig
};

//  Funciones auxiliares que se usarán en varios módulos
export function getCurrentUser() { return currentUser; }
export function setCurrentUser(user) { currentUser = user; }

export function getPerrosDB() { return perrosDB; }
export function setPerrosDB(data) { perrosDB = data; }

export function getReservasDB() { return reservasDB; }
export function setReservasDB(data) { reservasDB = data; }

export function getFacturasDB() { return facturasDB; }
export function setFacturasDB(data) { facturasDB = data; }

export function getTrainingDB() { return trainingDB; }
export function setTrainingDB(data) { trainingDB = data; }

export function getCalendarDate() { return calendarDate; }
export function setCalendarDate(date) { calendarDate = date; }

export function getTrainingCalendarDate() { return trainingCalendarDate; }
export function setTrainingCalendarDate(date) { trainingCalendarDate = date; }

export function getContactosSeleccionados() { return contactosSeleccionados; }
export function setContactosSeleccionados(data) { contactosSeleccionados = data; }

export function getFacturasSeleccionadas() { return facturasSeleccionadas; }
export function setFacturasSeleccionadas(data) { facturasSeleccionadas = data; }

export function getFotoActualBase64() { return fotoActualBase64; }
export function setFotoActualBase64(data) { fotoActualBase64 = data; }

export function getFotoEditBase64() { return fotoEditBase64; }
export function setFotoEditBase64(data) { fotoEditBase64 = data; }

export function getPerrosGrupoReserva() { return perrosGrupoReserva; }
export function setPerrosGrupoReserva(data) { perrosGrupoReserva = data; }

export function getReservaEditActual() { return reservaEditActual; }
export function setReservaEditActual(data) { reservaEditActual = data; }

export function getClientLogoBase64() { return clientLogoBase64; }
export function setClientLogoBase64(data) { clientLogoBase64 = data; }

export function getCurrentConfig() { return currentConfig; }
export function setCurrentConfig(data) { currentConfig = data; }

export function getIsGeneratingInvoice() { return isGeneratingInvoice; }
export function setIsGeneratingInvoice(data) { isGeneratingInvoice = data; }

// ✅ Mensaje de confirmación en consola
console.log('✅ Firebase inicializado correctamente (js/firebase.js)');