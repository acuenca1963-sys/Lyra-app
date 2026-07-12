// lyra-app-v6/js/whatsapp.js
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function getPerrosPath() {
  const user = getCurrentUser();
  if (!user) throw new Error('No hay usuario autenticado');
  return `usuarios/${user.uid}/perros`;
}

function getConfigPath() {
  const user = getCurrentUser();
  return `usuarios/${user.uid}/configuracion/hotel`;
}

/**
 * Obtiene la configuración del hotel (incluye credenciales Meta)
 */
async function obtenerConfiguracion() {
  try {
    const configRef = doc(db, getConfigPath());
    const configDoc = await getDoc(configRef);
    if (configDoc.exists()) {
      return configDoc.data();
    }
    return {
      metaPhoneNumberId: '',
      metaAccessToken: '',
      metaBusinessId: '',
      metaTemplateName: ''
    };
  } catch (error) {
    console.error('Error obteniendo config:', error);
    return {
      metaPhoneNumberId: '',
      metaAccessToken: '',
      metaBusinessId: '',
      metaTemplateName: ''
    };
  }
}

/**
 * Obtiene todos los perros del usuario
 */
async function obtenerPerros() {
  try {
    const perrosPath = getPerrosPath();
    const snapshot = await getDocs(collection(db, perrosPath));
    const perros = [];
    snapshot.forEach(docSnap => {
      perros.push({ id: docSnap.id, ...docSnap.data() });
    });
    return perros;
  } catch (error) {
    console.error('Error obteniendo perros:', error);
    return [];
  }
}

/**
 * Obtiene la lista de contactos únicos (dueños con teléfono)
 */
export async function obtenerContactos() {
  try {
    const perros = await obtenerPerros();
    
    // Agrupar por dueño
    const contactosMap = {};
    perros.forEach(perro => {
      const nombre = perro.nombreDueno;
      const telefono = perro.telefono;
      const email = perro.email || '';
      
      if (!nombre || !telefono) return;
      
      const key = `${nombre}|${telefono}`;
      if (!contactosMap[key]) {
        contactosMap[key] = {
          nombre: nombre,
          telefono: telefono,
          email: email,
          perros: []
        };
      }
      contactosMap[key].perros.push(perro.nombrePerro);
    });
    
    const contactos = Object.values(contactosMap).sort((a, b) => 
      a.nombre.localeCompare(b.nombre)
    );
    
    return {
      success: true,
      contactos: contactos,
      total: contactos.length
    };
  } catch (error) {
    console.error('Error obteniendo contactos:', error);
    return {
      success: false,
      error: 'Error al cargar los contactos',
      contactos: []
    };
  }
}

/**
 * Busca contactos por nombre
 */
export async function buscarContactos(termino) {
  try {
    const resultado = await obtenerContactos();
    if (!resultado.success) return resultado;
    
    const terminoLower = termino.toLowerCase();
    const contactosFiltrados = resultado.contactos.filter(c => 
      c.nombre.toLowerCase().includes(terminoLower)
    );
    
    return {
      success: true,
      contactos: contactosFiltrados,
      total: contactosFiltrados.length
    };
  } catch (error) {
    console.error('Error buscando contactos:', error);
    return {
      success: false,
      error: 'Error en la búsqueda',
      contactos: []
    };
  }
}

/**
 * Formatea un número de teléfono para WhatsApp
 */
export function formatearTelefonoWhatsApp(telefono) {
  if (!telefono) return null;
  
  let telefonoLimpio = telefono.replace(/[\s\-\(\)]/g, '');
  
  // Si no empieza con 34 o +, añadir 34 (España)
  if (!telefonoLimpio.startsWith('34') && !telefonoLimpio.startsWith('+')) {
    telefonoLimpio = '34' + telefonoLimpio;
  }
  
  // Si empieza con +34, quitar el +
  if (telefonoLimpio.startsWith('+34')) {
    telefonoLimpio = telefonoLimpio.substring(1);
  }
  
  return telefonoLimpio;
}

/**
 * Abre WhatsApp Web con un mensaje para un contacto específico
 */
export function enviarWhatsAppIndividual(telefono, nombre, mensaje = null) {
  try {
    if (!telefono) {
      return {
        success: false,
        error: 'Sin teléfono'
      };
    }
    
    const telefonoLimpio = formatearTelefonoWhatsApp(telefono);
    const msg = mensaje || `Hola ${nombre}, te contacto desde Lyra App.`;
    const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(msg)}`;
    
    window.open(url, '_blank');
    
    return {
      success: true,
      message: 'WhatsApp abierto'
    };
  } catch (error) {
    console.error('Error enviando WhatsApp:', error);
    return {
      success: false,
      error: 'Error al enviar WhatsApp'
    };
  }
}

/**
 * Envía mensajes masivos (vía API Meta o WhatsApp Web)
 */
export async function enviarMasivo(telefonos, mensaje, usarAPI = true) {
  try {
    if (!mensaje || mensaje.trim() === '') {
      return {
        success: false,
        error: 'Escribe un mensaje'
      };
    }
    
    if (telefonos.length === 0) {
      return {
        success: false,
        error: 'Selecciona al menos un contacto'
      };
    }
    
    const config = await obtenerConfiguracion();
    const tieneCredenciales = config.metaAccessToken && config.metaPhoneNumberId;
    
    // Si hay credenciales y usarAPI es true, enviar vía API
    if (tieneCredenciales && usarAPI) {
      return await enviarMasivoAPI(telefonos, mensaje, config);
    } else {
      // Si no hay credenciales, enviar vía WhatsApp Web
      return await enviarMasivoWeb(telefonos, mensaje);
    }
    
  } catch (error) {
    console.error('Error en envío masivo:', error);
    return {
      success: false,
      error: error.message || 'Error al enviar mensajes'
    };
  }
}

/**
 * Envío masivo vía API de Meta (WhatsApp Business)
 */
async function enviarMasivoAPI(telefonos, mensaje, config) {
  const PROXY_URL = 'https://corsproxy.io/?';
  let enviados = 0;
  let errores = 0;
  let erroresDetalle = [];
  
  for (const telefono of telefonos) {
    const telefonoLimpio = formatearTelefonoWhatsApp(telefono);
    
    try {
      let payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telefonoLimpio
      };
      
      // Si hay plantilla configurada, usar plantilla
      if (config.metaTemplateName) {
        payload.type = "template";
        payload.template = {
          name: config.metaTemplateName,
          language: { code: "es_ES" }
        };
      } else {
        // Si no, enviar texto libre
        payload.type = "text";
        payload.text = { body: mensaje };
      }
      
      const apiUrl = `https://graph.facebook.com/v19.0/${config.metaPhoneNumberId}/messages`;
      const proxiedUrl = PROXY_URL + encodeURIComponent(apiUrl);
      
      const response = await fetch(proxiedUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.metaAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (data.error) {
        console.error('Error Meta:', data.error);
        errores++;
        erroresDetalle.push(`${telefonoLimpio}: ${data.error.message}`);
      } else {
        enviados++;
      }
      
    } catch (e) {
      console.error('Error red:', e);
      errores++;
      erroresDetalle.push(`${telefonoLimpio}: ${e.message}`);
    }
    
    // Delay de 1 segundo entre mensajes
    await new Promise(r => setTimeout(r, 1000));
  }
  
  let mensajeResultado = `Envío API completado.\nEnviados: ${enviados}\nErrores: ${errores}`;
  
  if (erroresDetalle.length > 0) {
    mensajeResultado += `\n\nDetalles de errores:\n${erroresDetalle.join('\n')}`;
  }
  
  return {
    success: true,
    enviados: enviados,
    errores: errores,
    mensaje: mensajeResultado
  };
}

/**
 * Envío masivo vía WhatsApp Web (apertura secuencial)
 */
async function enviarMasivoWeb(telefonos, mensaje) {
  let enviados = 0;
  
  for (const telefono of telefonos) {
    const telefonoLimpio = formatearTelefonoWhatsApp(telefono);
    const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;
    
    window.open(url, '_blank');
    enviados++;
    
    // Delay de 2 segundos entre aperturas
    await new Promise(r => setTimeout(r, 2000));
  }
  
  return {
    success: true,
    enviados: enviados,
    mensaje: `Envío completado. ${enviados} ventana(s) abierta(s).`
  };
}

/**
 * Obtiene los teléfonos únicos de una lista de nombres de dueños
 */
export async function obtenerTelefonosDeDuenos(nombresDuenos) {
  try {
    const perros = await obtenerPerros();
    const telefonosUnicos = [];
    
    nombresDuenos.forEach(nombre => {
      const perrosDelDueno = perros.filter(p => p.nombreDueno === nombre && p.telefono);
      perrosDelDueno.forEach(perro => {
        if (!telefonosUnicos.includes(perro.telefono)) {
          telefonosUnicos.push(perro.telefono);
        }
      });
    });
    
    return {
      success: true,
      telefonos: telefonosUnicos,
      total: telefonosUnicos.length
    };
  } catch (error) {
    console.error('Error obteniendo teléfonos:', error);
    return {
      success: false,
      error: 'Error al obtener teléfonos',
      telefonos: []
    };
  }
}