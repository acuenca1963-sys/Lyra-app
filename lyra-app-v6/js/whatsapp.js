// lyra-app-v6/js/whatsapp.js
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { 
    collection, getDocs, doc, getDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
 * Formatea un número de teléfono para WhatsApp (formato internacional sin +)
 */
export function formatearTelefonoWhatsApp(telefono) {
    if (!telefono) return null;
    let telefonoLimpio = telefono.replace(/[\s\-\(\)\+]/g, '');
    // Si no empieza con 34 (España), añadirlo
    if (!telefonoLimpio.startsWith('34')) {
        telefonoLimpio = '34' + telefonoLimpio;
    }
    return telefonoLimpio;
}

/**
 * Envía un mensaje a un contacto usando la API de Meta.
 * Si falla, hace fallback automático a WhatsApp Web.
 */
export async function enviarWhatsAppIndividual(telefono, nombre, mensaje = null) {
    try {
        if (!telefono) {
            return { success: false, error: 'Sin teléfono' };
        }

        const telefonoLimpio = formatearTelefonoWhatsApp(telefono);
        const msg = mensaje || `Hola ${nombre}, te contacto desde Lyra App.`;
        const config = await obtenerConfiguracion();
        const tieneCredenciales = config.metaAccessToken && config.metaPhoneNumberId;

        // Si hay credenciales, intentar envío por API
        if (tieneCredenciales) {
            const resultadoAPI = await enviarMensajeAPI(telefonoLimpio, msg, nombre, config);
            
            if (resultadoAPI.success) {
                return {
                    success: true,
                    message: '✅ Mensaje enviado por WhatsApp Business API',
                    via: 'api'
                };
            } else {
                // FALLO API → Fallback automático a WhatsApp Web
                console.warn('⚠️ API falló, abriendo WhatsApp Web como respaldo:', resultadoAPI.error);
                const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(msg)}`;
                window.open(url, '_blank');
                return {
                    success: true,
                    message: `⚠️ API falló (${resultadoAPI.error}). Se abrió WhatsApp Web como respaldo.`,
                    via: 'web-fallback',
                    errorAPI: resultadoAPI.error
                };
            }
        } else {
            // No hay credenciales → WhatsApp Web directo
            const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(msg)}`;
            window.open(url, '_blank');
            return {
                success: true,
                message: 'WhatsApp abierto (sin API configurada)',
                via: 'web'
            };
        }
    } catch (error) {
        console.error('Error enviando WhatsApp:', error);
        return { success: false, error: error.message || 'Error al enviar WhatsApp' };
    }
}

/**
 * Envía un mensaje individual usando la API de Meta (WhatsApp Cloud API)
 */
async function enviarMensajeAPI(telefono, mensaje, nombreCliente, config) {
    try {
        const apiUrl = `https://graph.facebook.com/v19.0/${config.metaPhoneNumberId}/messages`;
        
        let payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: telefono
        };

        // Si hay plantilla configurada, usar plantilla (obligatorio para mensajes proactivos)
        if (config.metaTemplateName && config.metaTemplateName.trim() !== '') {
            payload.type = "template";
            payload.template = {
                name: config.metaTemplateName.trim(),
                language: { code: "es_ES" }
            };
            // Si la plantilla tiene parámetros {{1}}, {{2}}, etc., se pueden añadir aquí
            // Por ahora enviamos el nombre del cliente como primer parámetro si existe
            if (nombreCliente) {
                payload.template.components = [{
                    type: "body",
                    parameters: [
                        { type: "text", text: nombreCliente }
                    ]
                }];
            }
        } else {
            // Texto libre (solo funciona si el cliente escribió en las últimas 24h)
            payload.type = "text";
            payload.text = { body: mensaje };
        }

        console.log('📤 Enviando a Meta API:', { url: apiUrl, to: telefono, plantilla: config.metaTemplateName || '(texto libre)' });

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.metaAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            console.error('❌ Error de Meta:', data.error);
            const errorMsg = data.error.message || 'Error desconocido de Meta';
            const errorCode = data.error.code || '';
            
            // Mensajes de error más claros para Antonio
            let mensajeClaro = errorMsg;
            if (errorCode === 131047) {
                mensajeClaro = 'El cliente no escribió en las últimas 24h. Usa una plantilla aprobada.';
            } else if (errorCode === 131030) {
                mensajeClaro = 'Nombre de plantilla incorrecto o no aprobada.';
            } else if (errorCode === 190 || errorCode === 401) {
                mensajeClaro = 'Token caducado o inválido. Renuévalo en Meta.';
            }
            
            return { success: false, error: mensajeClaro, code: errorCode };
        }

        return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
        console.error('Error de red con Meta:', error);
        return { success: false, error: error.message || 'Error de red' };
    }
}

/**
 * Envía mensajes masivos (vía API Meta con fallback a WhatsApp Web)
 */
export async function enviarMasivo(telefonos, mensaje, usarAPI = true) {
    try {
        if (!mensaje || mensaje.trim() === '') {
            return { success: false, error: 'Escribe un mensaje' };
        }
        if (telefonos.length === 0) {
            return { success: false, error: 'Selecciona al menos un contacto' };
        }

        const config = await obtenerConfiguracion();
        const tieneCredenciales = config.metaAccessToken && config.metaPhoneNumberId;

        if (tieneCredenciales && usarAPI) {
            return await enviarMasivoAPI(telefonos, mensaje, config);
        } else {
            return await enviarMasivoWeb(telefonos, mensaje);
        }
    } catch (error) {
        console.error('Error en envío masivo:', error);
        return { success: false, error: error.message || 'Error al enviar mensajes' };
    }
}

/**
 * Envío masivo vía API de Meta (con fallback a WhatsApp Web por cada fallo)
 */
async function enviarMasivoAPI(telefonos, mensaje, config) {
    let enviados = 0;
    let errores = 0;
    let fallbackWeb = 0;
    let erroresDetalle = [];

    for (const telefono of telefonos) {
        const telefonoLimpio = formatearTelefonoWhatsApp(telefono);

        try {
            const resultado = await enviarMensajeAPI(telefonoLimpio, mensaje, '', config);

            if (resultado.success) {
                enviados++;
            } else {
                // Fallback automático a WhatsApp Web
                const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;
                window.open(url, '_blank');
                fallbackWeb++;
                erroresDetalle.push(`${telefonoLimpio}: API falló → WhatsApp Web (${resultado.error})`);
            }
        } catch (e) {
            console.error('Error red:', e);
            fallbackWeb++;
            const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;
            window.open(url, '_blank');
            erroresDetalle.push(`${telefonoLimpio}: Error de red → WhatsApp Web`);
        }

        // Delay de 1 segundo entre mensajes (Meta limita la velocidad)
        await new Promise(r => setTimeout(r, 1000));
    }

    let mensajeResultado = `📊 Envío completado:\n✅ Enviados por API: ${enviados}\n🔄 Fallback a WhatsApp Web: ${fallbackWeb}\n❌ Errores totales: ${errores}`;

    if (erroresDetalle.length > 0) {
        mensajeResultado += `\n\n📝 Detalles:\n${erroresDetalle.slice(0, 10).join('\n')}`;
        if (erroresDetalle.length > 10) {
            mensajeResultado += `\n...y ${erroresDetalle.length - 10} más`;
        }
    }

    return {
        success: true,
        enviados: enviados,
        fallbackWeb: fallbackWeb,
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
        return { success: false, error: 'Error al obtener teléfonos', telefonos: [] };
    }
}