// lyra-app-v6/js/perros.js
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  query,
  orderBy,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * Obtiene la ruta base de la colección de perros del usuario actual
 */
function getPerrosPath() {
  const user = getCurrentUser();
  if (!user) throw new Error('No hay usuario autenticado');
  return `usuarios/${user.uid}/perros`;
}

/**
 * Crea un nuevo perro
 * @param {Object} data - Datos del perro
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function crearPerro(data) {
  try {
    if (!data.nombre) {
      throw new Error('El nombre del perro es obligatorio');
    }

    const perroData = {
      nombre: data.nombre.trim(),
      raza: data.raza || 'Mestizo',
      edad: data.edad || 0,
      peso: data.peso || 0,
      sexo: data.sexo || 'Macho',
      color: data.color || '',
      chip: data.chip || '',
      observaciones: data.observaciones || '',
      alergias: data.alergias || '',
      medicacion: data.medicacion || '',
      foto: data.foto || '',
      propietario: data.propietario || '',
      telefonoPropietario: data.telefonoPropietario || '',
      emailPropietario: data.emailPropietario || '',
      fechaRegistro: new Date().toISOString(),
      activo: true
    };

    const perrosPath = getPerrosPath();
    const perroId = crypto.randomUUID();
    const perroRef = doc(db, perrosPath, perroId);
    
    await setDoc(perroRef, { id: perroId, ...perroData });

    return {
      success: true,
      id: perroId,
      data: perroData,
      message: `Perro "${perroData.nombre}" registrado correctamente`
    };

  } catch (error) {
    console.error('Error al crear perro:', error);
    return {
      success: false,
      error: error.message || 'Error al registrar el perro'
    };
  }
}

/**
 * Obtiene todos los perros del usuario
 * @returns {Promise<Object>} Lista de perros
 */
export async function obtenerPerros() {
  try {
    const perrosPath = getPerrosPath();
    const q = query(collection(db, perrosPath), orderBy('fechaRegistro', 'desc'));
    const snapshot = await getDocs(q);

    const perros = [];
    snapshot.forEach(doc => {
      perros.push({ id: doc.id, ...doc.data() });
    });

    return {
      success: true,
      perros: perros,
      total: perros.length
    };

  } catch (error) {
    console.error('Error al obtener perros:', error);
    return {
      success: false,
      error: 'Error al cargar los perros',
      perros: []
    };
  }
}

/**
 * Obtiene un perro específico por su ID
 * @param {string} perroId - ID del perro
 * @returns {Promise<Object>} Datos del perro
 */
export async function obtenerPerro(perroId) {
  try {
    if (!perroId) {
      throw new Error('ID de perro requerido');
    }

    const perrosPath = getPerrosPath();
    const perroRef = doc(db, perrosPath, perroId);
    const perroDoc = await getDoc(perroRef);

    if (!perroDoc.exists()) {
      return {
        success: false,
        error: 'Perro no encontrado'
      };
    }

    return {
      success: true,
      perro: { id: perroDoc.id, ...perroDoc.data() }
    };

  } catch (error) {
    console.error('Error al obtener perro:', error);
    return {
      success: false,
      error: 'Error al cargar el perro'
    };
  }
}

/**
 * Actualiza los datos de un perro
 * @param {string} perroId - ID del perro
 * @param {Object} data - Datos a actualizar
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function actualizarPerro(perroId, data) {
  try {
    if (!perroId) {
      throw new Error('ID de perro requerido');
    }

    const perrosPath = getPerrosPath();
    const perroRef = doc(db, perrosPath, perroId);
    
    // Verificar que existe
    const perroDoc = await getDoc(perroRef);
    if (!perroDoc.exists()) {
      return {
        success: false,
        error: 'Perro no encontrado'
      };
    }

    // Actualizar solo los campos proporcionados
    const updateData = { ...data, fechaModificacion: new Date().toISOString() };
    await updateDoc(perroRef, updateData);

    return {
      success: true,
      message: 'Perro actualizado correctamente'
    };

  } catch (error) {
    console.error('Error al actualizar perro:', error);
    return {
      success: false,
      error: error.message || 'Error al actualizar el perro'
    };
  }
}

/**
 * Elimina un perro (marcado como inactivo)
 * @param {string} perroId - ID del perro
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function eliminarPerro(perroId) {
  try {
    if (!perroId) {
      throw new Error('ID de perro requerido');
    }

    const perrosPath = getPerrosPath();
    const perroRef = doc(db, perrosPath, perroId);
    
    // Verificar que existe
    const perroDoc = await getDoc(perroRef);
    if (!perroDoc.exists()) {
      return {
        success: false,
        error: 'Perro no encontrado'
      };
    }

    // Eliminación lógica (marcar como inactivo)
    await updateDoc(perroRef, { 
      activo: false, 
      fechaEliminacion: new Date().toISOString() 
    });

    return {
      success: true,
      message: 'Perro eliminado correctamente'
    };

  } catch (error) {
    console.error('Error al eliminar perro:', error);
    return {
      success: false,
      error: 'Error al eliminar el perro'
    };
  }
}

/**
 * Elimina físicamente un perro de Firestore
 * @param {string} perroId - ID del perro
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function eliminarPerroFisico(perroId) {
  try {
    if (!perroId) {
      throw new Error('ID de perro requerido');
    }

    const perrosPath = getPerrosPath();
    const perroRef = doc(db, perrosPath, perroId);
    await deleteDoc(perroRef);

    return {
      success: true,
      message: 'Perro eliminado permanentemente'
    };

  } catch (error) {
    console.error('Error al eliminar perro físicamente:', error);
    return {
      success: false,
      error: 'Error al eliminar el perro'
    };
  }
}

/**
 * Busca perros por nombre o propietario
 * @param {string} termino - Término de búsqueda
 * @returns {Promise<Object>} Perros encontrados
 */
export async function buscarPerros(termino) {
  try {
    const resultado = await obtenerPerros();
    
    if (!resultado.success) {
      return resultado;
    }

    const terminoLower = termino.toLowerCase();
    const perrosFiltrados = resultado.perros.filter(perro => {
      return (
        perro.nombre?.toLowerCase().includes(terminoLower) ||
        perro.raza?.toLowerCase().includes(terminoLower) ||
        perro.propietario?.toLowerCase().includes(terminoLower) ||
        perro.chip?.toLowerCase().includes(terminoLower)
      );
    });

    return {
      success: true,
      perros: perrosFiltrados,
      total: perrosFiltrados.length
    };

  } catch (error) {
    console.error('Error al buscar perros:', error);
    return {
      success: false,
      error: 'Error en la búsqueda',
      perros: []
    };
  }
}

/**
 * Obtiene estadísticas de los perros
 * @returns {Promise<Object>} Estadísticas
 */
export async function obtenerEstadisticasPerros() {
  try {
    const resultado = await obtenerPerros();
    
    if (!resultado.success) {
      return resultado;
    }

    const perros = resultado.perros.filter(p => p.activo !== false);
    
    const estadisticas = {
      total: perros.length,
      machos: perros.filter(p => p.sexo === 'Macho').length,
      hembras: perros.filter(p => p.sexo === 'Hembra').length,
      porRaza: {},
      conChip: perros.filter(p => p.chip && p.chip.trim() !== '').length,
      conFoto: perros.filter(p => p.foto && p.foto.trim() !== '').length
    };

    // Agrupar por raza
    perros.forEach(perro => {
      const raza = perro.raza || 'Mestizo';
      estadisticas.porRaza[raza] = (estadisticas.porRaza[raza] || 0) + 1;
    });

    return {
      success: true,
      estadisticas: estadisticas
    };

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return {
      success: false,
      error: 'Error al calcular estadísticas'
    };
  }
}