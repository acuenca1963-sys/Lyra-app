// lyra-app-v6/js/empleados.js
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
  updateDoc,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  deleteUser,
  updatePassword
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const auth = getAuth();

function getEmpleadosPath() {
  const user = getCurrentUser();
  if (!user) throw new Error('No hay usuario autenticado');
  return `usuarios/${user.uid}/empleados`;
}

function getHistorialPath() {
  const user = getCurrentUser();
  return `usuarios/${user.uid}/historial`;
}

function getPermisosPath() {
  const user = getCurrentUser();
  return `usuarios/${user.uid}/permisos`;
}

/**
 * Permisos por rol
 */
const PERMISOS_ROL = {
  admin: {
    perros: { ver: true, crear: true, editar: true, eliminar: true },
    reservas: { ver: true, crear: true, editar: true, eliminar: true },
    facturas: { ver: true, crear: true, editar: true, eliminar: true },
    training: { ver: true, crear: true, editar: true, eliminar: true },
    whatsapp: { ver: true, enviar: true },
    configuracion: { ver: true, editar: true },
    empleados: { ver: true, crear: true, editar: true, eliminar: true },
    estadisticas: { ver: true },
    historial: { ver: true }
  },
  recepcion: {
    perros: { ver: true, crear: true, editar: true, eliminar: false },
    reservas: { ver: true, crear: true, editar: true, eliminar: false },
    facturas: { ver: true, crear: true, editar: true, eliminar: false },
    training: { ver: true, crear: false, editar: false, eliminar: false },
    whatsapp: { ver: true, enviar: true },
    configuracion: { ver: false, editar: false },
    empleados: { ver: false, crear: false, editar: false, eliminar: false },
    estadisticas: { ver: true },
    historial: { ver: false }
  },
  adiestrador: {
    perros: { ver: true, crear: false, editar: false, eliminar: false },
    reservas: { ver: false, crear: false, editar: false, eliminar: false },
    facturas: { ver: false, crear: false, editar: false, eliminar: false },
    training: { ver: true, crear: true, editar: true, eliminar: true },
    whatsapp: { ver: true, enviar: true },
    configuracion: { ver: false, editar: false },
    empleados: { ver: false, crear: false, editar: false, eliminar: false },
    estadisticas: { ver: false },
    historial: { ver: false }
  }
};

/**
 * Obtiene todos los empleados
 */
export async function obtenerEmpleados() {
  try {
    const empleadosPath = getEmpleadosPath();
    const snapshot = await getDocs(collection(db, empleadosPath));
    const empleados = [];
    snapshot.forEach(docSnap => {
      empleados.push({ id: docSnap.id, ...docSnap.data() });
    });
    return {
      success: true,
      empleados: empleados,
      total: empleados.length
    };
  } catch (error) {
    console.error('Error obteniendo empleados:', error);
    return {
      success: false,
      error: 'Error al cargar los empleados',
      empleados: []
    };
  }
}

/**
 * Obtiene un empleado específico
 */
export async function obtenerEmpleado(id) {
  try {
    if (!id) throw new Error('ID de empleado requerido');
    const empleadosPath = getEmpleadosPath();
    const empleadoRef = doc(db, empleadosPath, id);
    const empleadoDoc = await getDoc(empleadoRef);
    
    if (!empleadoDoc.exists()) {
      return { success: false, error: 'Empleado no encontrado' };
    }
    
    return {
      success: true,
      empleado: { id: empleadoDoc.id, ...empleadoDoc.data() }
    };
  } catch (error) {
    console.error('Error obteniendo empleado:', error);
    return { success: false, error: 'Error al cargar el empleado' };
  }
}

/**
 * Crea un nuevo empleado (con usuario de Firebase Auth)
 */
export async function crearEmpleado(data) {
  try {
    // Validaciones
    if (!data.email || !data.password || !data.nombre || !data.rol) {
      throw new Error('Email, contraseña, nombre y rol son obligatorios');
    }
    
    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const uid = userCredential.user.uid;
    
    // Preparar datos del empleado
    const empleado = {
      uid: uid,
      email: data.email,
      nombre: data.nombre,
      apellidos: data.apellidos || '',
      telefono: data.telefono || '',
      rol: data.rol,
      activo: true,
      fechaAlta: new Date().toISOString(),
      notas: data.notas || '',
      fechaCreacion: serverTimestamp()
    };
    
    // Guardar en Firestore
    const empleadosPath = getEmpleadosPath();
    await setDoc(doc(db, empleadosPath, uid), empleado);
    
    // Registrar en historial
    await registrarAccion('crear', 'empleados', `Empleado creado: ${data.nombre} (${data.email}) - Rol: ${data.rol}`);
    
    return {
      success: true,
      id: uid,
      message: `Empleado ${data.nombre} creado correctamente`
    };
  } catch (error) {
    console.error('Error creando empleado:', error);
    return {
      success: false,
      error: error.message || 'Error al crear el empleado'
    };
  }
}

/**
 * Actualiza un empleado existente
 */
export async function actualizarEmpleado(id, data) {
  try {
    if (!id) throw new Error('ID de empleado requerido');
    
    const empleadosPath = getEmpleadosPath();
    const empleadoRef = doc(db, empleadosPath, id);
    
    // Verificar que existe
    const empleadoDoc = await getDoc(empleadoRef);
    if (!empleadoDoc.exists()) {
      return { success: false, error: 'Empleado no encontrado' };
    }
    
    // Actualizar datos
    const updateData = {
      ...data,
      fechaModificacion: serverTimestamp()
    };
    
    await updateDoc(empleadoRef, updateData);
    
    // Registrar en historial
    await registrarAccion('editar', 'empleados', `Empleado actualizado: ${data.nombre || id}`);
    
    return {
      success: true,
      message: 'Empleado actualizado correctamente'
    };
  } catch (error) {
    console.error('Error actualizando empleado:', error);
    return {
      success: false,
      error: error.message || 'Error al actualizar el empleado'
    };
  }
}

/**
 * Elimina un empleado
 */
export async function eliminarEmpleado(id) {
  try {
    if (!id) throw new Error('ID de empleado requerido');
    
    const empleadosPath = getEmpleadosPath();
    
    // Verificar que existe
    const empleadoDoc = await getDoc(doc(db, empleadosPath, id));
    if (!empleadoDoc.exists()) {
      return { success: false, error: 'Empleado no encontrado' };
    }
    
    const empleado = empleadoDoc.data();
    
    // Eliminar de Firestore
    await deleteDoc(doc(db, empleadosPath, id));
    
    // Eliminar usuario de Firebase Auth (si es posible)
    try {
      const currentUser = auth.currentUser;
      if (currentUser && currentUser.uid === id) {
        // No se puede eliminar a sí mismo
        console.warn('No se puede eliminar el usuario actual');
      } else {
        await deleteUser(empleadoDoc.ref);
      }
    } catch (authError) {
      console.warn('No se pudo eliminar el usuario de Auth:', authError.message);
    }
    
    // Registrar en historial
    await registrarAccion('eliminar', 'empleados', `Empleado eliminado: ${empleado.nombre} (${empleado.email})`);
    
    return {
      success: true,
      message: 'Empleado eliminado correctamente'
    };
  } catch (error) {
    console.error('Error eliminando empleado:', error);
    return {
      success: false,
      error: error.message || 'Error al eliminar el empleado'
    };
  }
}

/**
 * Cambia el estado activo/inactivo de un empleado
 */
export async function toggleEmpleadoActivo(id, activo) {
  try {
    const empleadosPath = getEmpleadosPath();
    const empleadoRef = doc(db, empleadosPath, id);
    
    await updateDoc(empleadoRef, { 
      activo: activo,
      fechaModificacion: serverTimestamp()
    });
    
    const accion = activo ? 'activar' : 'desactivar';
    await registrarAccion(accion, 'empleados', `Empleado ${activo ? 'activado' : 'desactivado'}: ${id}`);
    
    return {
      success: true,
      message: `Empleado ${activo ? 'activado' : 'desactivado'} correctamente`
    };
  } catch (error) {
    console.error('Error cambiando estado:', error);
    return {
      success: false,
      error: 'Error al cambiar el estado del empleado'
    };
  }
}

/**
 * Verifica si el usuario actual tiene permiso para una acción
 */
export async function tienePermiso(modulo, accion) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
    
    // Si es el propietario (admin principal), siempre tiene permisos
    const empleadosPath = getEmpleadosPath();
    const empleadoDoc = await getDoc(doc(db, empleadosPath, currentUser.uid));
    
    if (!empleadoDoc.exists()) {
      // Si no está en la lista de empleados, es el admin principal
      return true;
    }
    
    const empleado = empleadoDoc.data();
    if (!empleado.activo) return false;
    
    const permisos = PERMISOS_ROL[empleado.rol];
    if (!permisos) return false;
    
    return permisos[modulo] && permisos[modulo][accion] === true;
  } catch (error) {
    console.error('Error verificando permisos:', error);
    return false;
  }
}

/**
 * Obtiene los permisos del usuario actual
 */
export async function obtenerPermisosUsuario() {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return null;
    
    const empleadosPath = getEmpleadosPath();
    const empleadoDoc = await getDoc(doc(db, empleadosPath, currentUser.uid));
    
    if (!empleadoDoc.exists()) {
      // Admin principal tiene todos los permisos
      return { rol: 'admin', permisos: PERMISOS_ROL.admin };
    }
    
    const empleado = empleadoDoc.data();
    return {
      rol: empleado.rol,
      nombre: empleado.nombre,
      permisos: PERMISOS_ROL[empleado.rol] || {}
    };
  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    return null;
  }
}

/**
 * Registra una acción en el historial
 */
export async function registrarAccion(accion, modulo, descripcion, datosAnteriores = null, datosNuevos = null) {
  try {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const historialPath = getHistorialPath();
    
    const registro = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      accion: accion,
      modulo: modulo,
      descripcion: descripcion,
      datosAnteriores: datosAnteriores,
      datosNuevos: datosNuevos,
      fecha: serverTimestamp(),
      fechaISO: new Date().toISOString()
    };
    
    await addDoc(collection(db, historialPath), registro);
  } catch (error) {
    console.error('Error registrando acción:', error);
  }
}

/**
 * Obtiene el historial de acciones
 */
export async function obtenerHistorial(filtros = {}) {
  try {
    const historialPath = getHistorialPath();
    let q = query(collection(db, historialPath), orderBy('fecha', 'desc'));
    
    const snapshot = await getDocs(q);
    let historial = [];
    
    snapshot.forEach(docSnap => {
      historial.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    // Aplicar filtros
    if (filtros.modulo) {
      historial = historial.filter(h => h.modulo === filtros.modulo);
    }
    if (filtros.accion) {
      historial = historial.filter(h => h.accion === filtros.accion);
    }
    if (filtros.userId) {
      historial = historial.filter(h => h.userId === filtros.userId);
    }
    if (filtros.desde) {
      historial = historial.filter(h => h.fechaISO >= filtros.desde);
    }
    if (filtros.hasta) {
      historial = historial.filter(h => h.fechaISO <= filtros.hasta);
    }
    
    return {
      success: true,
      historial: historial,
      total: historial.length
    };
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    return {
      success: false,
      error: 'Error al cargar el historial',
      historial: []
    };
  }
}

/**
 * Obtiene estadísticas del historial
 */
export async function obtenerEstadisticasHistorial() {
  try {
    const resultado = await obtenerHistorial();
    if (!resultado.success) return resultado;
    
    const historial = resultado.historial;
    
    // Acciones por módulo
    const porModulo = {};
    historial.forEach(h => {
      porModulo[h.modulo] = (porModulo[h.modulo] || 0) + 1;
    });
    
    // Acciones por tipo
    const porAccion = {};
    historial.forEach(h => {
      porAccion[h.accion] = (porAccion[h.accion] || 0) + 1;
    });
    
    // Acciones por usuario
    const porUsuario = {};
    historial.forEach(h => {
      const key = h.userEmail || h.userId;
      porUsuario[key] = (porUsuario[key] || 0) + 1;
    });
    
    return {
      success: true,
      total: historial.length,
      porModulo: porModulo,
      porAccion: porAccion,
      porUsuario: porUsuario
    };
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return {
      success: false,
      error: 'Error al calcular estadísticas'
    };
  }
}

/**
 * Cambia la contraseña de un empleado
 */
export async function cambiarPasswordEmpleado(id, nuevaPassword) {
  try {
    if (!id || !nuevaPassword) {
      throw new Error('ID y nueva contraseña son obligatorios');
    }
    
    if (nuevaPassword.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }
    
    // Nota: Solo se puede cambiar la contraseña del usuario actual en Firebase Auth
    // Para cambiar la de otro usuario, se requeriría Cloud Functions
    const currentUser = auth.currentUser;
    if (currentUser.uid === id) {
      await updatePassword(currentUser, nuevaPassword);
      await registrarAccion('editar', 'empleados', 'Contraseña actualizada (propio usuario)');
      return { success: true, message: 'Contraseña actualizada correctamente' };
    } else {
      return { 
        success: false, 
        error: 'Solo puedes cambiar tu propia contraseña desde la app' 
      };
    }
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    return {
      success: false,
      error: error.message || 'Error al cambiar la contraseña'
    };
  }
}

/**
 * Busca empleados por nombre o email
 */
export async function buscarEmpleados(termino) {
  try {
    const resultado = await obtenerEmpleados();
    if (!resultado.success) return resultado;
    
    const terminoLower = termino.toLowerCase();
    const empleadosFiltrados = resultado.empleados.filter(e => 
      e.nombre.toLowerCase().includes(terminoLower) ||
      e.email.toLowerCase().includes(terminoLower) ||
      (e.apellidos && e.apellidos.toLowerCase().includes(terminoLower))
    );
    
    return {
      success: true,
      empleados: empleadosFiltrados,
      total: empleadosFiltrados.length
    };
  } catch (error) {
    console.error('Error buscando empleados:', error);
    return {
      success: false,
      error: 'Error en la búsqueda',
      empleados: []
    };
  }
}