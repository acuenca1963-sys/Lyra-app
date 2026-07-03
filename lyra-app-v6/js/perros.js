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
 * Crea un nuevo perro con TODOS los campos exactos de la v5.17
 */
export async function crearPerro(data) {
  try {
    if (!data.nombrePerro) {
      throw new Error('El nombre del perro es obligatorio');
    }

    if (!data.nombreDueno) {
      throw new Error('El nombre del dueño es obligatorio');
    }

    const perroData = {
      // Datos principales del perro
      nombrePerro: data.nombrePerro.trim(),
      raza: data.raza || 'Mestizo',
      fechaNacimiento: data.fechaNacimiento || '',
      edad: data.edad || '',
      sexo: data.sexo || '',
      microchip: data.microchip || '',
      pasaporte: data.pasaporte || '',
      
      // Datos del dueño
      nombreDueno: data.nombreDueno.trim(),
      dniDueno: data.dniDueno || '',
      telefono: data.telefono || '',
      email: data.email || '',
      direccion: data.direccion || '',
      
      // Veterinario y notas
      veterinario: data.veterinario || '',
      notas: data.notas || '',
      
      // Salud y cuidados
      estadoPelo: data.estadoPelo || 'Bien',
      medicacion: data.medicacion || 'No',
      detallesMedicacion: data.detallesMedicacion || '',
      alergias: data.alergias || '',
      
      // Tarifa especial
      precioPersonalizado: data.precioPersonalizado || 0,
      
      // Foto
      foto: data.foto || '',
      fotoUrl: data.fotoUrl || '',
      tieneFoto: data.tieneFoto || false,
      
      // Sistema
      fechaCreacion: new Date().toISOString(),
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
      message: `Perro "${perroData.nombrePerro}" registrado correctamente`
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
 */
export async function obtenerPerros() {
  try {
    const perrosPath = getPerrosPath();
    const q = query(collection(db, perrosPath), orderBy('nombrePerro', 'asc'));
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
 */
export async function actualizarPerro(perroId, data) {
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

    const updateData = { ...data };
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
 * Elimina un perro de Firestore
 */
export async function eliminarPerro(perroId) {
  try {
    if (!perroId) {
      throw new Error('ID de perro requerido');
    }

    const perrosPath = getPerrosPath();
    const perroRef = doc(db, perrosPath, perroId);
    await deleteDoc(perroRef);

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
 * Busca perros por nombre, dueño, microchip o raza
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
        (perro.nombrePerro && perro.nombrePerro.toLowerCase().includes(terminoLower)) ||
        (perro.nombreDueno && perro.nombreDueno.toLowerCase().includes(terminoLower)) ||
        (perro.microchip && perro.microchip.toLowerCase().includes(terminoLower)) ||
        (perro.raza && perro.raza.toLowerCase().includes(terminoLower))
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
      conMicrochip: perros.filter(p => p.microchip && p.microchip.trim() !== '').length,
      conFoto: perros.filter(p => (p.foto || p.fotoUrl) && p.tieneFoto).length,
      conMedicacion: perros.filter(p => p.medicacion === 'Sí').length,
      conAlergias: perros.filter(p => p.alergias && p.alergias.trim() !== '').length
    };

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

/**
 * Calcula la edad a partir de la fecha de nacimiento
 */
export function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return '';
  
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mes = hoy.getMonth() - nacimiento.getMonth();
  
  if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  
  if (edad >= 1) {
    return `${edad} año${edad > 1 ? 's' : ''}`;
  } else {
    const meses = (hoy.getMonth() - nacimiento.getMonth() + 12) % 12;
    return `${meses} mes${meses !== 1 ? 'es' : ''}`;
  }
}

/**
 * Obtiene dueños únicos con sus perros
 */
export async function obtenerDuenos() {
  try {
    const resultado = await obtenerPerros();
    
    if (!resultado.success) {
      return resultado;
    }

    const dueñosMap = {};
    
    resultado.perros.forEach(perro => {
      const nombreDueno = perro.nombreDueno;
      if (!dueñosMap[nombreDueno]) {
        dueñosMap[nombreDueno] = {
          nombre: nombreDueno,
          dni: perro.dniDueno,
          telefono: perro.telefono,
          email: perro.email,
          direccion: perro.direccion,
          perros: []
        };
      }
      dueñosMap[nombreDueno].perros.push(perro);
    });

    const dueños = Object.values(dueñosMap).sort((a, b) => 
      a.nombre.localeCompare(b.nombre)
    );

    return {
      success: true,
      dueños: dueños,
      total: dueños.length
    };

  } catch (error) {
    console.error('Error al obtener dueños:', error);
    return {
      success: false,
      error: 'Error al cargar los dueños',
      dueños: []
    };
  }
}