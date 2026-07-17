// lyra-app-v6/js/configuracion.js
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { 
  doc, 
  getDoc, 
  setDoc,
  collection,
  getDocs,
  deleteDoc,
  addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const LOGO_URL_LYRA = "https://raw.githubusercontent.com/acuenca1963-sys/Lyra-app/main/logo-lyra.png";

function getConfigPath() {
  const user = getCurrentUser();
  if (!user) throw new Error('No hay usuario autenticado');
  return `usuarios/${user.uid}/configuracion/hotel`;
}

function getPerrosPath() {
  const user = getCurrentUser();
  return `usuarios/${user.uid}/perros`;
}

function getReservasPath() {
  const user = getCurrentUser();
  return `usuarios/${user.uid}/reservas`;
}

function getFacturasPath() {
  const user = getCurrentUser();
  return `usuarios/${user.uid}/facturas`;
}

function getTrainingPath() {
  const user = getCurrentUser();
  return `usuarios/${user.uid}/training`;
}

/**
 * Valores por defecto de la configuración
 */
const CONFIG_DEFAULTS = {
  hotelName: 'Lyra App',
  clientName: '',
  clientCIF: '',
  clientAddress: '',
  clientPhone: '',
  clientLogo: null,
  totalKennels: 15,
  kennelPrefix: 'C-',
  prices: { 
    hotel: 15, 
    guarderia: 10, 
    claseSuelta: 35, 
    pack10: 350, 
    pack20: 500 
  },
  nextInvoiceNumber: 1,
  metaPhoneNumberId: '',
  metaAccessToken: '',
  metaBusinessId: '',
  metaTemplateName: ''
};

/**
 * Obtiene la configuración completa del hotel
 */
export async function obtenerConfiguracion() {
  try {
    const configRef = doc(db, getConfigPath());
    const configDoc = await getDoc(configRef);
    
    if (configDoc.exists()) {
      return {
        success: true,
        config: { ...CONFIG_DEFAULTS, ...configDoc.data() }
      };
    }
    
    return {
      success: true,
      config: { ...CONFIG_DEFAULTS }
    };
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    return {
      success: false,
      error: 'Error al cargar la configuración',
      config: { ...CONFIG_DEFAULTS }
    };
  }
}

/**
 * Guarda la configuración del hotel
 */
export async function guardarConfiguracion(configData) {
  try {
    const configRef = doc(db, getConfigPath());
    const configCompleta = { ...CONFIG_DEFAULTS, ...configData };
    
    await setDoc(configRef, configCompleta);
    
    return {
      success: true,
      message: 'Configuración guardada correctamente'
    };
  } catch (error) {
    console.error('Error guardando configuración:', error);
    return {
      success: false,
      error: 'Error al guardar la configuración'
    };
  }
}

/**
 * Comprime una imagen para reducir su tamaño
 */
export function compressImage(base64, maxSize, callback) {
  const img = new Image();
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxWidth = 600;
      const maxHeight = 600;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/jpeg', 0.7);
      callback(compressed);
    } catch (e) {
      console.error("Error comprimiendo imagen:", e);
      callback(base64);
    }
  };
  img.onerror = () => { callback(base64); };
  img.src = base64;
}

/**
 * Exporta todos los datos del usuario como backup JSON
 */
export async function exportarBackup() {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error('No hay usuario autenticado');
    
    // Obtener configuración
    const configResult = await obtenerConfiguracion();
    const config = configResult.success ? configResult.config : CONFIG_DEFAULTS;
    
    // Obtener todos los datos
    const perrosSnapshot = await getDocs(collection(db, getPerrosPath()));
    const perros = perrosSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const reservasSnapshot = await getDocs(collection(db, getReservasPath()));
    const reservas = reservasSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const facturasSnapshot = await getDocs(collection(db, getFacturasPath()));
    const facturas = facturasSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const trainingSnapshot = await getDocs(collection(db, getTrainingPath()));
    const training = trainingSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    const backupData = {
      fecha: new Date().toISOString(),
      config: config,
      perros: perros,
      reservas: reservas,
      facturas: facturas,
      training: training
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "lyra_backup_" + new Date().toISOString().slice(0,10) + ".json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    return {
      success: true,
      message: 'Copia de seguridad descargada correctamente'
    };
  } catch (error) {
    console.error('Error exportando backup:', error);
    return {
      success: false,
      error: 'Error al exportar la copia de seguridad'
    };
  }
}

/**
 * Importa datos desde un backup JSON
 */
export async function importarBackup(file) {
  try {
    const user = getCurrentUser();
    if (!user) throw new Error('No hay usuario autenticado');
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          
          if (!backupData.fecha || !backupData.config) {
            throw new Error('El archivo de backup no es válido');
          }
          
          // Borrar todos los datos actuales
          const perrosSnapshot = await getDocs(collection(db, getPerrosPath()));
          const reservasSnapshot = await getDocs(collection(db, getReservasPath()));
          const facturasSnapshot = await getDocs(collection(db, getFacturasPath()));
          const trainingSnapshot = await getDocs(collection(db, getTrainingPath()));
          
          const deletePromises = [];
          perrosSnapshot.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          reservasSnapshot.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          facturasSnapshot.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          trainingSnapshot.forEach(d => deletePromises.push(deleteDoc(d.ref)));
          
          await Promise.all(deletePromises);
          
          // Restaurar datos
          const restorePromises = [];
          
          if (backupData.perros) {
            backupData.perros.forEach(p => {
              const { id, ...data } = p;
              restorePromises.push(addDoc(collection(db, getPerrosPath()), data));
            });
          }
          
          if (backupData.reservas) {
            backupData.reservas.forEach(r => {
              const { id, ...data } = r;
              restorePromises.push(addDoc(collection(db, getReservasPath()), data));
            });
          }
          
          if (backupData.facturas) {
            backupData.facturas.forEach(f => {
              const { id, ...data } = f;
              restorePromises.push(addDoc(collection(db, getFacturasPath()), data));
            });
          }
          
          if (backupData.training) {
            backupData.training.forEach(t => {
              const { id, ...data } = t;
              restorePromises.push(addDoc(collection(db, getTrainingPath()), data));
            });
          }
          
          await Promise.all(restorePromises);
          
          // Guardar configuración
          await guardarConfiguracion(backupData.config);
          
          resolve({
            success: true,
            message: 'Copia de seguridad restaurada correctamente'
          });
          
        } catch (err) {
          reject({
            success: false,
            error: 'El archivo de backup no es válido o está corrupto'
          });
        }
      };
      reader.onerror = () => {
        reject({
          success: false,
          error: 'Error al leer el archivo'
        });
      };
      reader.readAsText(file);
    });
  } catch (error) {
    console.error('Error importando backup:', error);
    return {
      success: false,
      error: 'Error al importar la copia de seguridad'
    };
  }
}

/**
 * Obtiene el precio de un servicio según la configuración
 */
export async function obtenerPrecioServicio(servicio) {
  const configResult = await obtenerConfiguracion();
  if (!configResult.success) return 0;
  
  const prices = configResult.config.prices;
  
  if (servicio === 'hotel') return prices.hotel;
  if (servicio === 'guarderia') return prices.guarderia;
  if (servicio === 'clase-suelta') return prices.claseSuelta;
  if (servicio === 'pack-10') return prices.pack10;
  if (servicio === 'pack-20') return prices.pack20;
  return 0;
}

/**
 * Obtiene el siguiente número de factura y lo incrementa
 */
export async function obtenerSiguienteNumeroFactura() {
  try {
    const configResult = await obtenerConfiguracion();
    if (!configResult.success) throw new Error('Error al cargar configuración');
    
    const config = configResult.config;
    const numeroActual = config.nextInvoiceNumber || 1;
    const numeroFormateado = String(numeroActual).padStart(4, '0');
    
    // Incrementar para la próxima
    await guardarConfiguracion({
      ...config,
      nextInvoiceNumber: numeroActual + 1
    });
    
    return {
      success: true,
      numero: numeroFormateado,
      numeroNumerico: numeroActual
    };
  } catch (error) {
    console.error('Error obteniendo número de factura:', error);
    return {
      success: false,
      error: 'Error al obtener número de factura'
    };
  }
}