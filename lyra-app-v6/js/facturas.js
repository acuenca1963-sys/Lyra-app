// lyra-app-v6/js/facturas.js
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
    addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

function getFacturasPath() {
    const user = getCurrentUser();
    if (!user) throw new Error('No hay usuario autenticado');
    return `usuarios/${user.uid}/facturas`;
}

function getConfigPath() {
    const user = getCurrentUser();
    return `usuarios/${user.uid}/configuracion/hotel`;
}

function getPerrosPath() {
    const user = getCurrentUser();
    return `usuarios/${user.uid}/perros`;
}

/**
 * Obtiene la configuración del hotel
 */
async function obtenerConfiguracion() {
    try {
        const configRef = doc(db, getConfigPath());
        const configDoc = await getDoc(configRef);
        if (configDoc.exists()) {
            return configDoc.data();
        }
        // Valores por defecto (sin referencias a Lyra)
        return {
            hotelName: '',
            clientName: '',
            clientCIF: '',
            clientAddress: '',
            clientPhone: '',
            clientEmail: '',
            clientLogo: null,
            prices: { hotel: 15, guarderia: 10, claseSuelta: 35, pack10: 350, pack20: 500 },
            nextInvoiceNumber: 1
        };
    } catch (error) {
        console.error('Error obteniendo config:', error);
        return {
            hotelName: '',
            clientName: '',
            clientCIF: '',
            clientAddress: '',
            clientPhone: '',
            clientEmail: '',
            clientLogo: null,
            prices: { hotel: 15, guarderia: 10, claseSuelta: 35, pack10: 350, pack20: 500 },
            nextInvoiceNumber: 1
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
        const perros = {};
        snapshot.forEach(docSnap => {
            perros[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
        });
        return perros;
    } catch (error) {
        console.error('Error obteniendo perros:', error);
        return {};
    }
}

/**
 * Obtiene el precio de un servicio según la configuración
 */
export async function obtenerPrecioServicio(servicio) {
    const config = await obtenerConfiguracion();
    const prices = config.prices || { hotel: 15, guarderia: 10, claseSuelta: 35, pack10: 350, pack20: 500 };
    if (servicio === 'hotel') return prices.hotel;
    if (servicio === 'guarderia') return prices.guarderia;
    if (servicio === 'clase-suelta') return prices.claseSuelta;
    if (servicio === 'pack-10') return prices.pack10;
    if (servicio === 'pack-20') return prices.pack20;
    return 0;
}

/**
 * Obtiene todos los dueños únicos
 */
export async function obtenerDuenos() {
    try {
        const perros = await obtenerPerros();
        const dueñosMap = {};
        Object.values(perros).forEach(perro => {
            const nombreDueno = perro.nombreDueno;
            if (nombreDueno && !dueñosMap[nombreDueno]) {
                dueñosMap[nombreDueno] = {
                    nombre: nombreDueno,
                    dni: perro.dniDueno || '',
                    telefono: perro.telefono || '',
                    email: perro.email || '',
                    direccion: perro.direccion || '',
                    perros: []
                };
            }
            if (nombreDueno) {
                dueñosMap[nombreDueno].perros.push(perro);
            }
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
        console.error('Error obteniendo dueños:', error);
        return {
            success: false,
            error: 'Error al cargar los dueños',
            dueños: []
        };
    }
}

/**
 * Busca dueños por nombre
 */
export async function buscarDuenos(termino) {
    try {
        const resultado = await obtenerDuenos();
        if (!resultado.success) return resultado;
        const terminoLower = termino.toLowerCase();
        const dueñosFiltrados = resultado.dueños.filter(d =>
            d.nombre.toLowerCase().includes(terminoLower)
        );
        return {
            success: true,
            dueños: dueñosFiltrados,
            total: dueñosFiltrados.length
        };
    } catch (error) {
        console.error('Error buscando dueños:', error);
        return {
            success: false,
            error: 'Error en la búsqueda',
            dueños: []
        };
    }
}

/**
 * Obtiene perros de un dueño específico
 */
export async function obtenerPerrosPorDueno(nombreDueno) {
    try {
        const perros = await obtenerPerros();
        const perrosDelDueno = Object.values(perros).filter(p =>
            p.nombreDueno === nombreDueno
        );
        return {
            success: true,
            perros: perrosDelDueno,
            total: perrosDelDueno.length
        };
    } catch (error) {
        console.error('Error obteniendo perros del dueño:', error);
        return {
            success: false,
            error: 'Error al cargar los perros',
            perros: []
        };
    }
}

/**
 * Busca perros por nombre, opcionalmente filtrado por dueño
 */
export async function buscarPerros(termino, nombreDueno = null) {
    try {
        const perros = await obtenerPerros();
        const terminoLower = termino.toLowerCase();
        let perrosFiltrados = Object.values(perros).filter(p => {
            const coincideNombre = p.nombrePerro && p.nombrePerro.toLowerCase().includes(terminoLower);
            const coincideDueno = p.nombreDueno && p.nombreDueno.toLowerCase().includes(terminoLower);
            return coincideNombre || coincideDueno;
        });
        if (nombreDueno) {
            perrosFiltrados = perrosFiltrados.filter(p => p.nombreDueno === nombreDueno);
        }
        return {
            success: true,
            perros: perrosFiltrados,
            total: perrosFiltrados.length
        };
    } catch (error) {
        console.error('Error buscando perros:', error);
        return {
            success: false,
            error: 'Error en la búsqueda',
            perros: []
        };
    }
}

/**
 * Obtiene el siguiente número de factura y lo incrementa
 */
export async function obtenerSiguienteNumeroFactura() {
    try {
        const config = await obtenerConfiguracion();
        const numeroActual = config.nextInvoiceNumber || 1;
        const numeroFormateado = String(numeroActual).padStart(4, '0');
        // Incrementar para la próxima
        const configRef = doc(db, getConfigPath());
        await updateDoc(configRef, {
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

/**
 * Calcula totales de la factura (base, IVA, total)
 */
export function calcularTotalesFactura(conceptos) {
    let baseTotal = 0;
    conceptos.forEach(concepto => {
        const cantidad = parseFloat(concepto.cantidad) || 0;
        const precio = parseFloat(concepto.precio) || 0;
        const subtotal = cantidad * precio;
        concepto.subtotal = subtotal.toFixed(2);
        baseTotal += subtotal;
    });
    const iva = baseTotal * 0.21;
    const total = baseTotal + iva;
    return {
        baseImponible: baseTotal.toFixed(2),
        iva: iva.toFixed(2),
        total: total.toFixed(2)
    };
}

/**
 * Crea una factura multi-concepto
 */
export async function crearFactura(data) {
    try {
        // Validaciones
        if (!data.cliente) {
            throw new Error('Debes seleccionar un dueño');
        }
        if (!data.conceptos || data.conceptos.length === 0) {
            throw new Error('Debes añadir al menos un concepto');
        }
        // Obtener siguiente número de factura
        const numeroResult = await obtenerSiguienteNumeroFactura();
        if (!numeroResult.success) {
            throw new Error(numeroResult.error);
        }
        // Calcular totales
        const totales = calcularTotalesFactura(data.conceptos);
        // Obtener datos del perro si existe
        const perros = await obtenerPerros();
        const perro = data.idPerro ? perros[data.idPerro] : null;
        // Preparar datos de la factura
        const factura = {
            numero: numeroResult.numero,
            fecha: new Date().toLocaleDateString('es-ES'),
            fechaISO: new Date().toISOString(),
            cliente: data.cliente,
            clienteDNI: perro?.dniDueno || data.clienteDNI || '',
            clienteDireccion: perro?.direccion || data.clienteDireccion || '',
            clienteTelefono: perro?.telefono || data.clienteTelefono || '',
            clienteEmail: perro?.email || data.clienteEmail || '',
            nombrePerro: perro?.nombrePerro || data.nombrePerro || '',
            idPerro: data.idPerro || '',
            conceptos: data.conceptos.map(c => ({
                servicio: c.servicio,
                cantidad: c.cantidad,
                precio: c.precio,
                subtotal: c.subtotal
            })),
            baseImponible: parseFloat(totales.baseImponible),
            iva: parseFloat(totales.iva),
            total: parseFloat(totales.total),
            fechaCreacion: new Date().toISOString()
        };
        // Guardar en Firestore
        const facturasPath = getFacturasPath();
        const docRef = await addDoc(collection(db, facturasPath), factura);
        return {
            success: true,
            id: docRef.id,
            numero: numeroResult.numero,
            message: `Factura #${numeroResult.numero} generada correctamente`
        };
    } catch (error) {
        console.error('Error creando factura:', error);
        return {
            success: false,
            error: error.message || 'Error al generar la factura'
        };
    }
}

/**
 * Obtiene todas las facturas
 */
export async function obtenerFacturas() {
    try {
        const facturasPath = getFacturasPath();
        const q = query(collection(db, facturasPath), orderBy('fechaCreacion', 'desc'));
        const snapshot = await getDocs(q);
        const facturas = [];
        snapshot.forEach(docSnap => {
            facturas.push({ id: docSnap.id, ...docSnap.data() });
        });
        return {
            success: true,
            facturas: facturas,
            total: facturas.length
        };
    } catch (error) {
        console.error('Error obteniendo facturas:', error);
        return {
            success: false,
            error: 'Error al cargar las facturas',
            facturas: []
        };
    }
}

/**
 * Obtiene una factura específica
 */
export async function obtenerFactura(id) {
    try {
        if (!id) {
            throw new Error('ID de factura requerido');
        }
        const facturasPath = getFacturasPath();
        const facturaRef = doc(db, facturasPath, id);
        const facturaDoc = await getDoc(facturaRef);
        if (!facturaDoc.exists()) {
            return {
                success: false,
                error: 'Factura no encontrada'
            };
        }
        return {
            success: true,
            factura: { id: facturaDoc.id, ...facturaDoc.data() }
        };
    } catch (error) {
        console.error('Error obteniendo factura:', error);
        return {
            success: false,
            error: 'Error al cargar la factura'
        };
    }
}

/**
 * Actualiza una factura existente
 */
export async function actualizarFactura(id, data) {
    try {
        if (!id) {
            throw new Error('ID de factura requerido');
        }
        const facturasPath = getFacturasPath();
        const facturaRef = doc(db, facturasPath, id);
        // Verificar que existe
        const facturaDoc = await getDoc(facturaRef);
        if (!facturaDoc.exists()) {
            return {
                success: false,
                error: 'Factura no encontrada'
            };
        }
        // Si se actualiza el total, recalcular base e IVA
        const updateData = { ...data };
        if (data.total !== undefined) {
            const total = parseFloat(data.total) || 0;
            const base = total / 1.21;
            const iva = base * 0.21;
            updateData.baseImponible = base;
            updateData.iva = iva;
        }
        await updateDoc(facturaRef, updateData);
        return {
            success: true,
            message: 'Factura actualizada correctamente'
        };
    } catch (error) {
        console.error('Error actualizando factura:', error);
        return {
            success: false,
            error: error.message || 'Error al actualizar la factura'
        };
    }
}

/**
 * Elimina una factura
 */
export async function eliminarFactura(id) {
    try {
        if (!id) {
            throw new Error('ID de factura requerido');
        }
        const facturasPath = getFacturasPath();
        await deleteDoc(doc(db, facturasPath, id));
        return {
            success: true,
            message: 'Factura eliminada correctamente'
        };
    } catch (error) {
        console.error('Error eliminando factura:', error);
        return {
            success: false,
            error: 'Error al eliminar la factura'
        };
    }
}

/**
 * Genera el HTML de impresión de una factura (SOLO datos de tu empresa, sin Lyra)
 */
export async function generarHTMLFactura(factura) {
    try {
        const config = await obtenerConfiguracion();

        // Datos de la empresa (desde configuración)
        const clientLogoHtml = config.clientLogo
            ? `<img src="${config.clientLogo}" alt="Logo Empresa">`
            : '';
        const clientName = config.clientName || 'Nombre de Tu Empresa';
        const clientCIF = config.clientCIF
            ? `<p><strong>CIF/NIF:</strong> ${config.clientCIF}</p>`
            : '';
        const clientAddress = config.clientAddress
            ? `<p><strong>Dirección:</strong> ${config.clientAddress}</p>`
            : '';
        const clientPhone = config.clientPhone
            ? `<p><strong>Teléfono:</strong> ${config.clientPhone}</p>`
            : '';
        const clientEmail = config.clientEmail
            ? `<p><strong>Email:</strong> ${config.clientEmail}</p>`
            : '';

        // Generar filas de conceptos
        const conceptosHTML = factura.conceptos && factura.conceptos.length > 0
            ? factura.conceptos.map(c => `
                <tr>
                    <td>${c.servicio}</td>
                    <td style="text-align:center;">${c.cantidad}</td>
                    <td style="text-align:right;">${parseFloat(c.precio).toFixed(2)} €</td>
                    <td style="text-align:right;">${c.subtotal} €</td>
                </tr>
            `).join('')
            : `<tr>
                    <td>${factura.servicio || 'Servicio General'}</td>
                    <td style="text-align:center;">1</td>
                    <td style="text-align:right;">${(factura.total/1.21).toFixed(2)} €</td>
                    <td style="text-align:right;">${(factura.total/1.21).toFixed(2)} €</td>
               </tr>`;

        const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura ${factura.numero}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            max-width: 800px; 
            margin: 0 auto; 
            color: #333;
        }
        .factura-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start;
            margin-bottom: 30px; 
            padding-bottom: 20px; 
            border-bottom: 3px solid #334155; 
        }
        .factura-empresa { 
            text-align: left; 
            flex: 1;
        }
        .factura-empresa img { 
            max-width: 150px; 
            max-height: 100px; 
            object-fit: contain; 
            margin-bottom: 10px; 
            display: block;
        }
        .factura-empresa h2 { 
            color: #334155; 
            font-size: 22px; 
            margin: 5px 0; 
        }
        .factura-empresa p { 
            margin: 4px 0; 
            font-size: 14px; 
        }
        .factura-numero {
            text-align: right;
            min-width: 200px;
        }
        .factura-numero h1 {
            color: #f59e0b;
            font-size: 32px;
            margin: 0 0 10px 0;
            letter-spacing: 2px;
        }
        .factura-numero p {
            margin: 4px 0;
            font-size: 14px;
        }
        .factura-info { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 30px; 
            gap: 20px;
        }
        .factura-cliente, .factura-detalles { 
            flex: 1; 
            padding: 15px; 
            background: #f8fafc; 
            border-radius: 8px; 
            border-left: 4px solid #f59e0b;
        }
        .factura-cliente h4, .factura-detalles h4 { 
            color: #334155; 
            margin: 0 0 10px 0; 
            border-bottom: 2px solid #334155; 
            padding-bottom: 5px; 
        }
        .factura-cliente p, .factura-detalles p { 
            margin: 5px 0; 
            font-size: 13px; 
        }
        .factura-tabla { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px; 
        }
        .factura-tabla th { 
            background: #334155; 
            color: white; 
            padding: 12px; 
            text-align: left; 
        }
        .factura-tabla td { 
            padding: 12px; 
            border-bottom: 1px solid #ddd; 
        }
        .factura-totales { 
            width: 100%; 
            max-width: 300px; 
            margin-left: auto; 
        }
        .factura-totales .fila { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 15px; 
            border-bottom: 1px solid #eee; 
        }
        .factura-totales .fila.total { 
            background: #334155; 
            color: white; 
            font-weight: bold; 
            font-size: 16px; 
            border-radius: 5px; 
            margin-top: 5px;
        }
        .factura-footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 2px solid #334155; 
            text-align: center; 
            font-size: 12px; 
            color: #666; 
        }
        @media print { 
            body { padding: 20px; } 
        }
    </style>
</head>
<body>
    <div class="factura-header">
        <div class="factura-empresa">
            ${clientLogoHtml}
            <h2>${clientName}</h2>
            ${clientCIF}
            ${clientAddress}
            ${clientPhone}
            ${clientEmail}
        </div>
        <div class="factura-numero">
            <h1>FACTURA</h1>
            <p><strong>Nº:</strong> ${factura.numero}</p>
            <p><strong>Fecha:</strong> ${factura.fecha || ''}</p>
        </div>
    </div>

    <div class="factura-info">
        <div class="factura-cliente">
            <h4>📋 Datos del Cliente</h4>
            <p><strong>Nombre:</strong> ${factura.cliente || ''}</p>
            <p><strong>DNI:</strong> ${factura.clienteDNI || '-'}</p>
            <p><strong>Dirección:</strong> ${factura.clienteDireccion || '-'}</p>
            <p><strong>Teléfono:</strong> ${factura.clienteTelefono || '-'}</p>
            <p><strong>Email:</strong> ${factura.clienteEmail || '-'}</p>
        </div>
        <div class="factura-detalles">
            <h4>📝 Detalles del Servicio</h4>
            <p><strong>Perro:</strong> ${factura.nombrePerro || '-'}</p>
            <p><strong>Conceptos:</strong> ${factura.conceptos && factura.conceptos.length > 0 ? factura.conceptos.map(c => c.servicio).join(', ') : factura.servicio || ''}</p>
        </div>
    </div>

    <table class="factura-tabla">
        <thead>
            <tr>
                <th>Concepto</th>
                <th style="text-align:center;">Cantidad</th>
                <th style="text-align:right;">Precio Unit.</th>
                <th style="text-align:right;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            ${conceptosHTML}
        </tbody>
    </table>

    <div class="factura-totales">
        <div class="fila">
            <span>Base Imponible:</span>
            <span>${factura.baseImponible.toFixed(2)} €</span>
        </div>
        <div class="fila">
            <span>IVA (21%):</span>
            <span>${factura.iva.toFixed(2)} €</span>
        </div>
        <div class="fila total">
            <span>TOTAL:</span>
            <span>${factura.total.toFixed(2)} €</span>
        </div>
    </div>

    <div class="factura-footer">
        <p>¡Gracias por confiar en ${clientName}!</p>
        <p>Para cualquier consulta, contacte con nosotros.</p>
    </div>

    <script>window.onload = function() { setTimeout(() => { window.print(); }, 300); };<\/script>
</body>
</html>`;

        return {
            success: true,
            html: htmlContent
        };
    } catch (error) {
        console.error('Error generando HTML:', error);
        return {
            success: false,
            error: 'Error al generar el HTML de la factura'
        };
    }
}

/**
 * Imprime una factura abriendo ventana nueva
 */
export async function imprimirFactura(id) {
    try {
        const resultado = await obtenerFactura(id);
        if (!resultado.success) {
            return resultado;
        }
        const htmlResult = await generarHTMLFactura(resultado.factura);
        if (!htmlResult.success) {
            return htmlResult;
        }
        const blob = new Blob([htmlResult.html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (!printWindow) {
            return {
                success: false,
                error: 'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes e inténtalo de nuevo.'
            };
        }
        return {
            success: true,
            message: 'Ventana de impresión abierta'
        };
    } catch (error) {
        console.error('Error imprimiendo factura:', error);
        return {
            success: false,
            error: 'Error al imprimir la factura'
        };
    }
}

/**
 * Formatea una fecha ISO a formato español
 */
export function formatearFecha(fechaISO) {
    if (!fechaISO) return '-';
    const partes = fechaISO.split('-');
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fechaISO;
}