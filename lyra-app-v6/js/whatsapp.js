import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getCurrentUser } from './auth.js';

// Formatea el teléfono a formato E.164 internacional (ej: 34600123456)
export function formatearTelefonoWhatsApp(telefono) {
    if (!telefono) return '';
    let limpio = telefono.replace(/[^0-9]/g, '');
    if (limpio.startsWith('00')) limpio = limpio.substring(2);
    if (limpio.startsWith('+')) limpio = limpio.substring(1);
    // Si es un número español de 9 dígitos y no tiene el 34, se lo añadimos
    if (!limpio.startsWith('34') && limpio.length === 9) {
        limpio = '34' + limpio;
    }
    return limpio;
}

// Obtiene la configuración de WhatsApp desde Firestore
async function obtenerConfiguracionWhatsApp() {
    const user = getCurrentUser();
    if (!user) throw new Error('No hay usuario autenticado');
    
    const docRef = doc(db, 'usuarios', user.uid, 'configuracion', 'principal');
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        return docSnap.data();
    }
    return null;
}

// Función central que habla con la API de Meta
async function enviarMensajeMeta(phoneNumberId, accessToken, telefonoDestino, mensaje, templateName = '') {
    const telefonoFormateado = formatearTelefonoWhatsApp(telefonoDestino);
    
    // Si hay nombre de plantilla, usamos el formato de plantilla de Meta
    // Si no, intentamos enviar texto libre (solo funcionará si hay ventana de 24h abierta)
    const payload = templateName ? {
        messaging_product: "whatsapp",
        to: telefonoFormateado,
        type: "template",
        template: {
            name: templateName,
            language: { code: "es" }
        }
    } : {
        messaging_product: "whatsapp",
        to: telefonoFormateado,
        type: "text",
        text: { body: mensaje }
    };

    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (!response.ok) {
        console.error('Error Meta API:', data);
        throw new Error(data.error?.message || 'Error desconocido de Meta');
    }
    
    return data;
}

// Envío individual
export async function enviarWhatsAppIndividual(telefono, nombre, mensaje) {
    try {
        const config = await obtenerConfiguracionWhatsApp();
        
        // Si tenemos la configuración de Meta, usamos la API oficial
        if (config && config.metaAccessToken && config.metaPhoneNumberId) {
            await enviarMensajeMeta(
                config.metaPhoneNumberId, 
                config.metaAccessToken, 
                telefono, 
                mensaje,
                config.metaTemplateName || ''
            );
            return { success: true, message: '✅ Mensaje enviado vía Meta API' };
        } 
        
        // FALLBACK: Si no hay config de Meta, usamos el método clásico (abre pestaña)
        const telefonoLimpio = formatearTelefonoWhatsApp(telefono);
        const url = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;
        window.open(url, '_blank');
        return { success: true, message: '🔄 Abriendo WhatsApp Web...' };
        
    } catch (error) {
        console.error('Error enviando WhatsApp:', error);
        return { success: false, error: error.message };
    }
}

// Envío masivo
export async function enviarMasivo(listaTelefonos, mensaje, esPrueba = false) {
    try {
        const config = await obtenerConfiguracionWhatsApp();
        let exitosos = 0;
        let fallos = 0;
        const errores = [];

        // Si no hay config de Meta, no podemos hacer envío masivo en segundo plano
        if (!config || !config.metaAccessToken || !config.metaPhoneNumberId) {
            return { success: false, error: 'Configura la API de Meta en Ajustes para habilitar el envío masivo automático.' };
        }

        for (const tel of listaTelefonos) {
            try {
                await enviarMensajeMeta(
                    config.metaPhoneNumberId,
                    config.metaAccessToken,
                    tel,
                    mensaje,
                    config.metaTemplateName || ''
                );
                exitosos++;
                
                // Pausa de 1.5 segundos entre mensajes para evitar el "Rate Limit" (bloqueo por exceso de velocidad) de Meta
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                fallos++;
                errores.push(`${tel}: ${error.message}`);
                console.warn(`Fallo al enviar a ${tel}:`, error.message);
            }
        }

        let mensajeFinal = `✅ Proceso finalizado.\nEnviados: ${exitosos}\nFallidos: ${fallos}`;
        if (errores.length > 0) {
            mensajeFinal += `\n\n⚠️ Errores:\n${errores.slice(0, 3).join('\n')}${errores.length > 3 ? '\n...y más.' : ''}`;
        }

        return { success: true, mensaje: mensajeFinal };
        
    } catch (error) {
        console.error('Error en envío masivo:', error);
        return { success: false, error: error.message };
    }
}

// Helpers que usa el HTML principal
export function obtenerTelefonosDeDuenos(nombresDuenos) {
    // Esta función se apoya en que el HTML principal ya filtró los datos, 
    // pero la mantenemos por compatibilidad con tu código actual.
    return { success: true, telefonos: nombresDuenos }; 
}

export async function obtenerContactos() {
    return { success: true, contactos: [] }; // Se gestiona principalmente desde el estado global del HTML
}

export async function buscarContactos(texto) {
    return { success: true, contactos: [] }; // Se gestiona principalmente desde el estado global del HTML
}