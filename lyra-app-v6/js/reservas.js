// lyra-app-v6/js/reservas.js
import { db } from './firebase.js';
import { getCurrentUser } from './auth.js';
import { 
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, 
  query, where, orderBy, updateDoc, addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function getReservasPath() {
  const user = getCurrentUser();
  if (!user) throw new Error('No hay usuario autenticado');
  return `usuarios/${user.uid}/reservas`;
}

function getConfigPath() {
  const user = getCurrentUser();
  return `usuarios/${user.uid}/configuracion/hotel`;
}

/**
 * Obtiene la configuración del hotel (precios, casetas)
 */
async function obtenerConfiguracion() {
  try {
    const configRef = doc(db, getConfigPath());
    const configDoc = await getDoc(configRef);
    if (configDoc.exists()) {
      return configDoc.data();
    }
    // Valores por defecto si no hay config
    return {
      totalKennels: 15,
      kennelPrefix: 'C-',
      prices: { hotel: 15, guarderia: 10, claseSuelta: 35, pack10: 350, pack20: 500 }
    };
  } catch (error) {
    console.error('Error obteniendo config:', error);
    return { totalKennels: 15, kennelPrefix: 'C-', prices: { hotel: 15, guarderia: 10, claseSuelta: 35, pack10: 350, pack20: 500 } };
  }
}

/**
 * Obtiene todos los perros del usuario (necesario para buscar precios personalizados)
 */
async function obtenerPerrosParaPrecios() {
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
 * Calcula el precio de una reserva (exacta lógica de v5.17)
 */
export async function calcularPrecioReserva(tipo, inicio, fin, idPerro) {
  try {
    const config = await obtenerConfiguracion();
    const perros = await obtenerPerrosParaPrecios();
    const perro = perros[idPerro];
    
    let precioBase = 0;
    
    // 1. Comprobar precio personalizado del perro
    if (perro && perro.precioPersonalizado && perro.precioPersonalizado > 0) {
      precioBase = parseFloat(perro.precioPersonalizado);
    } else {
      // 2. Usar precio general de la config
      if (tipo === 'hotel') precioBase = config.prices.hotel;
      else if (tipo === 'guarderia') precioBase = config.prices.guarderia;
      else if (tipo === 'clase-suelta') precioBase = config.prices.claseSuelta;
      else if (tipo === 'pack-10') precioBase = config.prices.pack10;
      else if (tipo === 'pack-20') precioBase = config.prices.pack20;
    }

    // 3. Calcular total según tipo
    if (tipo === 'hotel' || tipo === 'guarderia') {
      if (!inicio || !fin) return 0;
      const dias = Math.ceil((new Date(fin) - new Date(inicio)) / (1000 * 60 * 60 * 24)) + 1;
      return dias * precioBase;
    } else {
      return precioBase;
    }
  } catch (error) {
    console.error('Error calculando precio:', error);
    return 0;
  }
}

/**
 * Encuentra una caseta libre (exacta lógica de v5.17)
 */
export async function encontrarCasetaLibre(entrada, salida, excluirId = null) {
  const config = await obtenerConfiguracion();
  const total = config.totalKennels || 15;
  const prefix = config.kennelPrefix || 'C-';
  
  const reservasPath = getReservasPath();
  const q = query(collection(db, reservasPath), where('tipo', '==', 'hotel'));
  const snapshot = await getDocs(q);
  
  const reservasHotel = [];
  snapshot.forEach(doc => {
    if (doc.id !== excluirId) reservasHotel.push(doc.data());
  });

  for (let caseta = 1; caseta <= total; caseta++) {
    const ocupada = reservasHotel.some(r => 
      r.caseta == caseta && 
      ((entrada >= r.inicio && entrada <= r.fin) || 
       (salida >= r.inicio && salida <= r.fin) || 
       (entrada <= r.inicio && salida >= r.fin))
    );
    
    if (!ocupada) {
      return { numero: caseta, nombre: `${prefix}${caseta}` };
    }
  }
  return null;
}

/**
 * Crea una reserva (Hotel, Guardería, Packs) con soporte para GRUPOS
 */
export async function crearReserva(data, idsPerrosGrupo = []) {
  try {
    const perros = await obtenerPerrosParaPrecios();
    const perroPrincipal = perros[data.idPerro];
    
    if (!perroPrincipal) throw new Error('Perro principal no encontrado');

    // Calcular días
    const dias = (data.tipo === 'hotel' || data.tipo === 'guarderia') 
      ? Math.ceil((new Date(data.fin) - new Date(data.inicio)) / (1000 * 60 * 60 * 24)) + 1 
      : 1;

    // Calcular precio final
    let precioFinal = data.precio;
    if (!precioFinal || precioFinal === 0) {
      precioFinal = await calcularPrecioReserva(data.tipo, data.inicio, data.fin, data.idPerro);
    }

    // Asignar caseta si es hotel
    let casetaAsignada = data.caseta || null;
    if (data.tipo === 'hotel' && !casetaAsignada) {
      const casetaLibre = await encontrarCasetaLibre(data.inicio, data.fin);
      if (!casetaLibre) throw new Error('HOTEL COMPLETO para esas fechas');
      casetaAsignada = casetaLibre.numero;
    }

    const grupoId = idsPerrosGrupo.length > 0 ? `grupo-${Date.now()}` : (data.grupoId || null);

    const reservaPrincipal = {
      idPerro: data.idPerro,
      nombrePerro: perroPrincipal.nombrePerro,
      nombreDueno: perroPrincipal.nombreDueno,
      telefono: perroPrincipal.telefono || '',
      tipo: data.tipo,
      inicio: data.inicio,
      fin: data.fin,
      dias: dias,
      precio: precioFinal,
      caseta: casetaAsignada,
      notas: data.notas || '',
      completadas: 0,
      total: dias,
      grupoId: grupoId,
      fechaCreacion: new Date().toISOString()
    };

    const reservasPath = getReservasPath();
    const docRef = await addDoc(collection(db, reservasPath), reservaPrincipal);

    // Crear reservas para los perros del grupo
    const idsCreados = [docRef.id];
    
    if (idsPerrosGrupo.length > 0) {
      for (const idPerroGrupo of idsPerrosGrupo) {
        const perroGrupo = perros[idPerroGrupo];
        if (perroGrupo) {
          const reservaGrupo = {
            ...reservaPrincipal,
            idPerro: idPerroGrupo,
            nombrePerro: perroGrupo.nombrePerro,
            nombreDueno: perroGrupo.nombreDueno,
            telefono: perroGrupo.telefono || '',
            caseta: casetaAsignada, // Misma caseta
            grupoId: grupoId
          };
          const docRefGrupo = await addDoc(collection(db, reservasPath), reservaGrupo);
          idsCreados.push(docRefGrupo.id);
        }
      }
    }

    return {
      success: true,
      ids: idsCreados,
      caseta: casetaAsignada,
      message: `Reserva(s) creada(s) correctamente${casetaAsignada ? ` en Caseta ${casetaAsignada}` : ''}`
    };

  } catch (error) {
    console.error('Error creando reserva:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene todas las reservas
 */
export async function obtenerReservas() {
  try {
    const reservasPath = getReservasPath();
    const q = query(collection(db, reservasPath), orderBy('inicio', 'desc'));
    const snapshot = await getDocs(q);

    const reservas = [];
    snapshot.forEach(doc => {
      reservas.push({ id: doc.id, ...doc.data() });
    });

    return { success: true, reservas };
  } catch (error) {
    console.error('Error obteniendo reservas:', error);
    return { success: false, error: error.message, reservas: [] };
  }
}

/**
 * Actualiza una reserva existente
 */
export async function actualizarReserva(id, data) {
  try {
    const reservasPath = getReservasPath();
    const reservaRef = doc(db, reservasPath, id);
    
    // Si cambian las fechas y es hotel, recalcular caseta si es necesario
    if (data.tipo === 'hotel' && (data.inicio || data.fin)) {
      const docSnap = await getDoc(reservaRef);
      if (docSnap.exists()) {
        const oldData = docSnap.data();
        const nuevaEntrada = data.inicio || oldData.inicio;
        const nuevaSalida = data.fin || oldData.fin;
        
        if (!data.caseta) { // Si no se especifica caseta manual, buscar libre
          const casetaLibre = await encontrarCasetaLibre(nuevaEntrada, nuevaSalida, id);
          if (casetaLibre) data.caseta = casetaLibre.numero;
        }
      }
    }

    await updateDoc(reservaRef, data);
    return { success: true, message: 'Reserva actualizada' };
  } catch (error) {
    console.error('Error actualizando reserva:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Marca clases/días como completados
 */
export async function marcarCompletada(id, cantidad) {
  try {
    const reservasPath = getReservasPath();
    const reservaRef = doc(db, reservasPath, id);
    const docSnap = await getDoc(reservaRef);
    
    if (!docSnap.exists()) throw new Error('Reserva no encontrada');
    
    const data = docSnap.data();
    const nuevasCompletadas = Math.min(data.completadas + cantidad, data.total);
    
    await updateDoc(reservaRef, { completadas: nuevasCompletadas });
    return { success: true, completadas: nuevasCompletadas };
  } catch (error) {
    console.error('Error marcando completada:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Elimina una reserva
 */
export async function eliminarReserva(id) {
  try {
    const reservasPath = getReservasPath();
    await deleteDoc(doc(db, reservasPath, id));
    return { success: true, message: 'Reserva eliminada' };
  } catch (error) {
    console.error('Error eliminando reserva:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene la ocupación del hotel para una fecha específica (para el calendario)
 */
export async function obtenerOcupacion(fecha) {
  try {
    const config = await obtenerConfiguracion();
    const totalK = config.totalKennels || 15;
    
    const reservasPath = getReservasPath();
    const q = query(
      collection(db, reservasPath), 
      where('tipo', '==', 'hotel'),
      where('inicio', '<=', fecha),
      where('fin', '>=', fecha)
    );
    const snapshot = await getDocs(q);
    
    const ocupadas = snapshot.size;
    const porcentaje = Math.round((ocupadas / totalK) * 100);
    
    return { ocupadas, total: totalK, porcentaje };
  } catch (error) {
    console.error('Error obteniendo ocupación:', error);
    return { ocupadas: 0, total: 15, porcentaje: 0 };
  }
}