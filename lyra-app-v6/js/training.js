// lyra-app-v6/js/training.js
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { 
  collection, addDoc, getDocs, deleteDoc, query, orderBy
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
  snapshot.forEach(doc => {
    perros[doc.id] = doc.data();
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
 * Obtiene todas las clases
 */
export async function obtenerClases() {
  try {
    const trainingPath = getTrainingPath();
    const q = query(collection(db, trainingPath), orderBy('fecha', 'desc'));
    const snapshot = await getDocs(q);

    const clases = [];
    snapshot.forEach(doc => {
      clases.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, clases };
  } catch (error) {
    console.error('Error obteniendo clases:', error);
    return { success: false, error: error.message, clases: [] };
  }
}

/**
 * Elimina una clase
 */
export async function eliminarClase(id) {
  try {
    const trainingPath = getTrainingPath();
    await deleteDoc(doc(db, trainingPath, id));
    return { success: true, message: 'Clase eliminada' };
  } catch (error) {
    console.error('Error eliminando clase:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Comprueba las alertas de clases para hoy y mañana (exacta lógica v5.17)
 */
export async function comprobarAvisosClases() {
  try {
    const resultado = await obtenerClases();
    if (!resultado.success) return { hoy: [], manana: [] };

    const hoy = new Date().toISOString().split('T')[0];
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const dateStrManana = manana.toISOString().split('T')[0];

    const clasesHoy = resultado.clases.filter(t => t.fecha === hoy);
    const clasesManana = resultado.clases.filter(t => t.fecha === dateStrManana);

    return { hoy: clasesHoy, manana: clasesManana };
  } catch (error) {
    console.error('Error comprobando avisos:', error);
    return { hoy: [], manana: [] };
  }
}