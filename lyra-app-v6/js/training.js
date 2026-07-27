// lyra-app-v6/js/training.js
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  doc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function getTrainingPath() {
  const user = getCurrentUser();
  if (!user) throw new Error('No hay usuario autenticado');
  return `usuarios/${user.uid}/training`;
}

/**
 * Obtiene todos los perros (para autocompletar datos al crear clase)
 */
async function obtenerPerros() {
  const user = getCurrentUser();
  const perrosPath = `usuarios/${user.uid}/perros`;
  const snapshot = await getDocs(collection(db, perrosPath));
  const perros = {};
  snapshot.forEach(docSnap => {
    perros[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
  });
  return perros;
}

/**
 * Crea una clase de adiestramiento
 */
export async function crearClase(data) {
  try {
    const perros = await obtenerPerros();
    const perro = perros[data.idPerro];
    
    if (!perro) throw new Error('Perro no encontrado');

    const clase = {
      idPerro: data.idPerro,
      nombrePerro: perro.nombrePerro,
      nombreDueno: perro.nombreDueno,
      telefono: perro.telefono || '',
      fecha: data.fecha,
      hora: data.hora,
      tipo: data.tipo || 'Sesión Individual',
      precio: parseFloat(data.precio) || 35,
      sesiones: parseInt(data.sesiones) || 1,
      completadas: 0,
      estado: 'programada', // 'programada', 'completada', 'cancelada'
      motivoCancelacion: '',
      fechaCreacion: new Date().toISOString()
    };

    const trainingPath = getTrainingPath();
    const docRef = await addDoc(collection(db, trainingPath), clase);

    return {
      success: true,
      id: docRef.id,
      message: 'Clase programada correctamente'
    };
  } catch (error) {
    console.error('Error creando clase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene todas las clases (ordenadas por fecha ascendente para facilitar vista mensual)
 */
export async function obtenerClases() {
  try {
    const trainingPath = getTrainingPath();
    // Ordenamos por fecha ascendente para que sea más fácil pintar calendarios mensuales
    const q = query(collection(db, trainingPath), orderBy('fecha', 'asc'));
    const snapshot = await getDocs(q);

    const clases = [];
    snapshot.forEach(docSnap => {
      clases.push({ id: docSnap.id, ...docSnap.data() });
    });

    return { success: true, clases };
  } catch (error) {
    console.error('Error obteniendo clases:', error);
    return { success: false, error: error.message, clases: [] };
  }
}

/**
 * ACTUALIZA una clase existente (Permite editar sesiones, precios, fechas, etc.)
 */
export async function actualizarClase(id, data) {
  try {
    const trainingPath = getTrainingPath();
    const updateData = {};
    
    // Solo actualizamos los campos que se nos pasan
    if (data.fecha !== undefined) updateData.fecha = data.fecha;
    if (data.hora !== undefined) updateData.hora = data.hora;
    if (data.tipo !== undefined) updateData.tipo = data.tipo;
    if (data.precio !== undefined) updateData.precio = parseFloat(data.precio);
    if (data.sesiones !== undefined) updateData.sesiones = parseInt(data.sesiones);
    if (data.completadas !== undefined) updateData.completadas = parseInt(data.completadas);
    if (data.estado !== undefined) updateData.estado = data.estado;
    if (data.motivoCancelacion !== undefined) updateData.motivoCancelacion = data.motivoCancelacion;

    await updateDoc(doc(db, trainingPath, id), updateData);
    return { success: true, message: 'Clase actualizada correctamente' };
  } catch (error) {
    console.error('Error actualizando clase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancela una clase (Recomendado sobre eliminar para mantener el historial)
 */
export async function cancelarClase(id, motivo) {
  try {
    return await actualizarClase(id, {
      estado: 'cancelada',
      motivoCancelacion: motivo || 'Sin motivo especificado'
    });
  } catch (error) {
    console.error('Error cancelando clase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Elimina una clase definitivamente (Usar con precaución)
 */
export async function eliminarClase(id) {
  try {
    const trainingPath = getTrainingPath();
    await deleteDoc(doc(db, trainingPath, id));
    return { success: true, message: 'Clase eliminada definitivamente' };
  } catch (error) {
    console.error('Error eliminando clase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Comprueba las alertas de clases para hoy y mañana
 * (Ignora las clases que ya están canceladas)
 */
export async function comprobarAvisosClases() {
  try {
    const resultado = await obtenerClases();
    if (!resultado.success) return { hoy: [], manana: [] };

    // Usamos fecha local para evitar problemas de zona horaria con toISOString()
    const hoy = new Date();
    const hoyStr = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const mananaStr = manana.getFullYear() + '-' + String(manana.getMonth() + 1).padStart(2, '0') + '-' + String(manana.getDate()).padStart(2, '0');

    // Filtramos solo las que están 'programadas'
    const clasesHoy = resultado.clases.filter(t => t.fecha === hoyStr && t.estado === 'programada');
    const clasesManana = resultado.clases.filter(t => t.fecha === mananaStr && t.estado === 'programada');

    return { hoy: clasesHoy, manana: clasesManana };
  } catch (error) {
    console.error('Error comprobando avisos:', error);
    return { hoy: [], manana: [] };
  }
}