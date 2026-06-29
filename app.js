const express = require('express');
const session = require('express-session');
const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const db = require('./db');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'ferreteria_secret_key',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Renueva la expiración de la cookie en cada solicitud
    cookie: { 
        secure: false,
        maxAge: 15 * 60 * 1000 // Expira en 15 minutos de inactividad
    }
}));

// Middleware de inactividad de sesión (15 minutos)
app.use((req, res, next) => {
    if (req.session && req.session.userId) {
        const ahora = Date.now();
        const ultimaActividad = req.session.lastActivity || ahora;
        const inactividadMax = 15 * 60 * 1000; // 15 minutos en milisegundos
        
        if (ahora - ultimaActividad > inactividadMax) {
            req.session.destroy((err) => {
                if (err) console.error('Error al destruir sesión por inactividad:', err);
                res.clearCookie('connect.sid');
                if (req.accepts('html') && req.method === 'GET') {
                    return res.redirect('/login?session_expired=true');
                }
                return res.status(401).json({ success: false, message: 'Sesión expirada por inactividad' });
            });
            return;
        }
        req.session.lastActivity = ahora;
    }
    next();
});

// Middleware global anti-caché para páginas HTML (dinámicas)
app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Middleware para verificar que el usuario esté autenticado
function requerirAutenticacion(req, res, next) {
    if (!req.session || !req.session.user) {
        if (!req.path.startsWith('/api') && req.accepts('html') && req.method === 'GET') {
            return res.redirect('/login?error=unauthorized');
        }
        return res.status(401).json({ success: false, message: 'No autenticado. Inicie sesión.' });
    }
    next();
}

// Middleware para verificar que el usuario tenga un rol autorizado
function requerirRol(rolesPermitidos) {
    return (req, res, next) => {
        if (!req.session || !req.session.user) {
            if (!req.path.startsWith('/api') && req.accepts('html') && req.method === 'GET') {
                return res.redirect('/login?error=unauthorized');
            }
            return res.status(401).json({ success: false, message: 'No autenticado. Inicie sesión.' });
        }
        
        const rolUsuario = req.session.user.role;
        if (!rolesPermitidos.includes(rolUsuario)) {
            if (!req.path.startsWith('/api') && req.accepts('html') && req.method === 'GET') {
                return res.redirect('/login?error=forbidden');
            }
            return res.status(403).json({ success: false, message: 'Acceso denegado. Permisos insuficientes.' });
        }
        next();
    };
}

// Helper para Registrar Auditoría
async function registrarAuditoria(userId, accion, tabla, registroId, detalles) {
    try {
        await db.query(
            `INSERT INTO AUDITORIA (id_usuario, accion, tabla_afectada, registro_id, detalles, fecha_accion) 
             VALUES ($1, $2, $3, $4, $5, GETDATE())`,
            [userId, accion, tabla, registroId, detalles]
        );
    } catch (err) {
        console.error('Error al registrar auditoría:', err.message);
    }
}

// --- RUTAS VISTAS TEMPORALES / ESTÁTICAS ---
app.get('/', (req, res) => {
    res.render('index', { title: 'Ferretería Palacios - Inicio' });
});

app.get('/search', (req, res) => {
    const query = req.query.q || '';
    res.render('productos', { 
        title: `Búsqueda: ${query}`,
        categoria: `Resultados para: "${query}"`,
        searchQuery: query
    });
});

app.get('/productos/:categoria', (req, res) => {
    const categoria = req.params.categoria;
    res.render('productos', { 
        title: `Categoría: ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`,
        categoria: categoria 
    });
});

app.get('/perfil', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('perfil', { title: 'Mi Perfil', user: req.session.user });
});

app.get('/historial', (req, res) => {
    res.render('historial', { title: 'Mi Historial de Compras - Ferretería Palacios' });
});

app.get('/login', (req, res) => {
    res.render('login', { title: 'Acceder - Ferretería Palacios' });
});

app.get('/carrito', (req, res) => {
    res.render('carrito', { title: 'Mi Carrito - Ferretería Palacios' });
});

app.get('/favoritos', (req, res) => {
    res.render('favoritos', { title: 'Mis Favoritos - Ferretería Palacios' });
});

app.get('/producto/:id', (req, res) => {
    res.render('detalle', { 
        title: 'Detalle del Producto - Ferretería Palacios',
        productId: req.params.id 
    });
});

// --- RUTA VISTAS PANEL DE ADMINISTRACIÓN ---
app.get('/admin', requerirRol(['Administrador', 'Empleado']), (req, res) => {
    res.render('admin', { title: 'Panel de Administración - Ferretería Palacios' });
});

app.get('/admin/inventario', requerirRol(['Administrador', 'Empleado']), (req, res) => {
    res.render('admin_inventario', { title: 'Gestión de Inventario - Ferretería Palacios' });
});

app.get('/admin/proveedores', requerirRol(['Administrador', 'Empleado']), (req, res) => {
    res.render('admin_proveedores', { title: 'Gestión de Proveedores - Ferretería Palacios' });
});

app.get('/admin/abastecimiento', requerirRol(['Administrador', 'Empleado']), (req, res) => {
    res.render('admin_abastecimiento', { title: 'Abastecimiento y Reposición - Ferretería Palacios' });
});

app.get('/admin/usuarios', requerirRol(['Administrador']), (req, res) => {
    res.render('admin_usuarios', { title: 'Gestión de Clientes - Ferretería Palacios' });
});

app.get('/admin/mermas', requerirRol(['Administrador', 'Empleado']), (req, res) => {
    res.render('admin_mermas', { title: 'Gestión de Mermas - Ferretería Palacios' });
});

app.get('/admin/personal', requerirRol(['Administrador']), (req, res) => {
    res.render('admin_personal', { title: 'Gestión de Personal - Ferretería Palacios' });
});

app.get('/admin/logistica', requerirRol(['Administrador', 'Empleado']), (req, res) => {
    res.render('admin_logistica', { title: 'Gestión de Logística - Ferretería Palacios' });
});

app.get('/admin/ventas', requerirRol(['Administrador', 'Empleado']), (req, res) => {
    res.render('admin_ventas', { title: 'Gestión de Ventas - Ferretería Palacios' });
});

app.get('/admin/reportes', requerirRol(['Administrador']), (req, res) => {
    res.render('admin_reportes', { title: 'Reportes y Analítica - Ferretería Palacios' });
});

app.get('/admin/auditoria', requerirRol(['Administrador']), (req, res) => {
    res.render('admin_auditoria', { title: 'Bitácora de Auditoría - Ferretería Palacios' });
});

app.get('/checkout', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.render('checkout', { title: 'Finalizar Compra - Ferretería Palacios', user: req.session.user });
});

app.get('/boleta/:id', (req, res) => {
    res.render('boleta', { 
        title: 'Boleta de Venta - Ferretería Palacios',
        orderId: req.params.id 
    });
});

// --- RUTAS DE API ---

// Obtener estado de la sesión activa
app.get('/api/session', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    if (req.session && req.session.userId) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.json({ success: false });
    }
});

// Cerrar sesión en el servidor
app.post('/api/logout', (req, res) => {
    if (req.session) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error al destruir sesión en el servidor:', err);
                return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
            }
            res.clearCookie('connect.sid');
            res.json({ success: true, message: 'Sesión finalizada en el servidor' });
        });
    } else {
        res.json({ success: true });
    }
});

// Obtener categorías mapeadas
app.get('/api/categorias', async (req, res) => {
    try {
        const result = await db.query('SELECT id_categoria as id, nombre_categoria as nombre FROM CATEGORIAS ORDER BY nombre_categoria ASC');
        res.json({ success: true, categories: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener categorías' });
    }
});

// Login Unificado (Busca primero en USUARIOS, luego en CLIENTES)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Buscar en Personal Interno
        let result = await db.query(
            `SELECT id_usuario as id, nombre_usuario as username, nombres, apellidos, 
                    (nombres + ' ' + apellidos) as nombre_completo, correo as email, 
                    contrasena as password, rol, estado, num_dni as dni, num_celular as phone 
             FROM USUARIOS 
             WHERE (correo = $1 OR nombre_usuario = $1) AND estado = 'Activo'`, 
            [username]
        );
        
        let userType = 'empleado';
        
        // Si no se encuentra, buscar en Clientes Externos
        if (result.rows.length === 0) {
            result = await db.query(
                `SELECT ID_Clientes as id, correo as username, nombres, apellidos, 
                        (nombres + ' ' + apellidos) as nombre_completo, correo as email, 
                        contrasena as password, 'Cliente' as rol, estado_cliente as estado,
                        direccion as address, num_celular as phone, num_dni as dni,
                        fecha_nacimiento as birthdate, fecha_registro as joined 
                 FROM CLIENTES 
                 WHERE correo = $1`, 
                [username]
            );
            userType = 'cliente';
        }
        
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario no encontrado o inactivo' });
        }
        
        const user = result.rows[0];
        if (user.estado !== 'Activo') {
            return res.status(403).json({ success: false, message: 'Cuenta desactivada' });
        }

        // Validación de contraseña cifrada con fallback a texto plano para cargas SQL iniciales
        let isMatch = false;
        if (password && user.password) {
            if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
                isMatch = await bcrypt.compare(password, user.password);
            } else {
                isMatch = (password === user.password);
            }
        }

        if (isMatch) {
            req.session.userId = user.id;
            req.session.user = {
                id: user.id,
                name: user.nombre_completo,
                nombres: user.nombres,
                apellidos: user.apellidos,
                email: user.email,
                role: user.rol,
                type: userType,
                dni: user.dni,
                birthdate: user.birthdate,
                phone: user.phone,
                address: user.address,
                joined: user.joined
            };

            res.json({
                success: true,
                user: req.session.user
            });
        } else {
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

// Registro de Clientes
app.post('/api/register', async (req, res) => {
    try {
        const { nombres, apellidos, dni, fecha_nacimiento, phone, address, email, password } = req.body;
        
        // Validar si el correo o el DNI ya existen
        const check = await db.query('SELECT ID_Clientes FROM CLIENTES WHERE correo = $1 OR num_dni = $2', [email, dni]);
        if (check.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'El correo o número de DNI ya está registrado' });
        }

        const hashedPass = await bcrypt.hash(password, 10);

        await db.query(
            `INSERT INTO CLIENTES (num_dni, nombres, apellidos, fecha_nacimiento, direccion, num_celular, correo, contrasena, estado_cliente, fecha_registro) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Activo', GETDATE())`,
            [dni, nombres, apellidos, fecha_nacimiento || null, address || '', phone || '', email, hashedPass]
        );

        res.json({ success: true, message: 'Cuenta creada con éxito' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en el servidor' });
    }
});

// --- APIS DE PROVEEDORES Y ABASTECIMIENTO ---

// Obtener proveedores de la base de datos
app.get('/api/proveedores', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ID_proveedores as id, razon_social, num_ruc, nombre_contacto, num_telefono, correo, direccion 
             FROM PROVEEDORES 
             ORDER BY razon_social ASC`
        );
        res.json({ success: true, proveedores: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener proveedores' });
    }
});

// Crear Proveedor
app.post('/api/proveedores', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const { razon_social, num_ruc, nombre_contacto, num_telefono, correo, direccion } = req.body;
        const actorId = req.session.userId || 1;

        // Validar si el RUC ya existe
        const check = await db.query('SELECT ID_proveedores FROM PROVEEDORES WHERE num_ruc = $1', [num_ruc]);
        if (check.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'El RUC del proveedor ya está registrado.' });
        }

        const result = await db.query(
            `INSERT INTO PROVEEDORES (razon_social, num_ruc, nombre_contacto, num_telefono, correo, direccion)
             VALUES ($1, $2, $3, $4, $5, $6);
             SELECT @@IDENTITY as insert_id;`,
            [razon_social, num_ruc, nombre_contacto || '', num_telefono || '', correo || '', direccion || '']
        );
        const provId = result.rows[0] ? result.rows[0].insert_id : null;

        await registrarAuditoria(
            actorId, 
            'CREAR_PROVEEDOR', 
            'PROVEEDORES', 
            provId, 
            `Creó el proveedor "${razon_social}" (RUC: ${num_ruc})`
        );

        res.json({ success: true, message: 'Proveedor creado con éxito.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al registrar el proveedor.' });
    }
});

// Actualizar Proveedor
app.put('/api/proveedores/:id', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const { id } = req.params;
        const { razon_social, num_ruc, nombre_contacto, num_telefono, correo, direccion } = req.body;
        const actorId = req.session.userId || 1;

        await db.query(
            `UPDATE PROVEEDORES 
             SET razon_social = $1, num_ruc = $2, nombre_contacto = $3, num_telefono = $4, correo = $5, direccion = $6 
             WHERE ID_proveedores = $7`,
            [razon_social, num_ruc, nombre_contacto || '', num_telefono || '', correo || '', direccion || '', id]
        );

        await registrarAuditoria(
            actorId, 
            'MODIFICAR_PROVEEDOR', 
            'PROVEEDORES', 
            id, 
            `Actualizó el proveedor "${razon_social}" (RUC: ${num_ruc})`
        );

        res.json({ success: true, message: 'Proveedor actualizado con éxito.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al actualizar el proveedor.' });
    }
});

// Eliminar Proveedor
app.delete('/api/proveedores/:id', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const { id } = req.params;
        const actorId = req.session.userId || 1;

        await db.query('DELETE FROM PROVEEDORES WHERE ID_proveedores = $1', [id]);

        await registrarAuditoria(
            actorId, 
            'ELIMINAR_PROVEEDOR', 
            'PROVEEDORES', 
            id, 
            `Eliminó el proveedor con ID: ${id}`
        );

        res.json({ success: true, message: 'Proveedor eliminado con éxito.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al eliminar el proveedor. Es posible que esté relacionado a compras registradas.' });
    }
});

// Obtener historial de compras a proveedores (abastecimiento)
app.get('/api/abastecimiento', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT c.id_compra_prov as id, c.num_factura, c.fecha_compra, c.monto_total, 
                   p.razon_social as proveedor_nombre, 
                   COALESCE(u.nombres + ' ' + u.apellidos, 'Sistema') as usuario_nombre
            FROM COMPRAS_PROVEEDOR c
            JOIN PROVEEDORES p ON c.id_proveedor = p.ID_proveedores
            LEFT JOIN USUARIOS u ON c.id_usuario = u.id_usuario
            ORDER BY c.fecha_compra DESC
        `);
        res.json({ success: true, compras: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener historial' });
    }
});

// Obtener detalles de una compra
app.get('/api/abastecimiento/detalle/:id', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const { id } = req.params;
        
        const compraRes = await db.query(`
            SELECT c.id_compra_prov as id, c.num_factura, c.fecha_compra, c.monto_total, 
                   p.razon_social as proveedor_nombre
            FROM COMPRAS_PROVEEDOR c
            JOIN PROVEEDORES p ON c.id_proveedor = p.ID_proveedores
            WHERE c.id_compra_prov = $1`,
            [id]
        );
        
        if (compraRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Compra no encontrada' });
        }
        
        const detallesRes = await db.query(`
            SELECT d.id_detalle_compra_prov as id, d.cantidad, d.precio_compra_neto, 
                   p.nombre_producto as nombre_producto
            FROM DETALLE_COMPRA_PROV d
            JOIN PRODUCTOS p ON d.id_producto = p.ID_producto
            WHERE d.id_compra = $1`,
            [id]
        );
        
        res.json({
            success: true,
            compra: compraRes.rows[0],
            detalles: detallesRes.rows
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener detalles' });
    }
});

// Registrar un nuevo abastecimiento (Factura con múltiples productos) e incrementar stock
app.post('/api/abastecimiento', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    const client = await db.connect();
    try {
        const { id_proveedor, num_factura, monto_total, id_usuario, detalles } = req.body;
        const actorId = id_usuario || 1;
        
        await client.query('BEGIN');
        
        const resultCompra = await client.query(
            `INSERT INTO COMPRAS_PROVEEDOR (id_proveedor, id_usuario, num_factura, fecha_compra, monto_total)
             VALUES ($1, $2, $3, GETDATE(), $4);
             SELECT @@IDENTITY as insert_id;`,
            [id_proveedor, actorId, num_factura, monto_total]
        );
        
        const compra_id = resultCompra.rows[0] ? resultCompra.rows[0].insert_id : null;
        
        for (let item of detalles) {
            await client.query(
                `INSERT INTO DETALLE_COMPRA_PROV (id_compra, id_producto, cantidad, precio_compra_neto)
                 VALUES ($1, $2, $3, $4)`,
                [compra_id, item.id_producto, item.cantidad, item.precio_compra_neto]
            );
            
            // Incrementar stock físico en la tabla PRODUCTOS
            await client.query(
                `UPDATE PRODUCTOS SET stock = stock + $1 WHERE ID_producto = $2`,
                [item.cantidad, item.id_producto]
            );
        }
        
        await client.query('COMMIT');
        
        await registrarAuditoria(
            actorId,
            'REGISTRAR_COMPRA',
            'COMPRAS_PROVEEDOR',
            compra_id,
            `Registró compra (Factura: ${num_factura}), Proveedor ID: ${id_proveedor}, Costo Total: S/ ${monto_total}`
        );
        
        res.json({ success: true, message: 'Compra registrada y stock actualizado con éxito.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar abastecimiento:', error);
        res.status(500).json({ success: false, message: 'Error en la transacción de abastecimiento.' });
    } finally {
        client.release();
    }
});

// --- APIS DE INVENTARIO ---

// Buscar productos
app.get('/api/productos/buscar', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ success: true, products: [] });
        
        const result = await db.query(`
            SELECT p.ID_producto as id, p.nombre_producto as nombre, p.nombre_marca as marca, p.descripcion, 
                   p.precio as precio_base, p.precio_igv as precio_final, p.stock, p.id_categoria as categoria_id, 
                   p.imagen_url, p.estado, c.nombre_categoria as category_name
            FROM PRODUCTOS p
            JOIN CATEGORIAS c ON p.id_categoria = c.id_categoria
            WHERE (p.nombre_producto LIKE $1 OR p.nombre_marca LIKE $1) AND p.estado != 'Eliminado'
        `, [`%${q}%`]);
        
        res.json({ success: true, products: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en la búsqueda' });
    }
});

// Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT p.ID_producto as id, p.nombre_producto as nombre, p.nombre_marca as marca, p.descripcion, 
                   p.precio as precio_base, p.precio_igv as precio_final, p.stock, p.id_categoria as categoria_id, 
                   p.imagen_url, p.estado, p.modificado_por, c.nombre_categoria as category_name, 
                   COALESCE(u.nombres + ' ' + u.apellidos, 'Sistema') as updated_by_name
            FROM PRODUCTOS p
            JOIN CATEGORIAS c ON p.id_categoria = c.id_categoria
            LEFT JOIN USUARIOS u ON p.modificado_por = u.id_usuario
            WHERE p.estado != 'Eliminado'
            ORDER BY p.ID_producto DESC
        `);
        res.json({ success: true, products: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener productos' });
    }
});

// Crear Producto
app.post('/api/productos', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const { nombre, categoria_id, descripcion, precio_base, stock, imagen_url, modificado_por, marca } = req.body;
        const id_proveedor = 1; // ID de proveedor por defecto (Aceros Arequipa S.A.)

        const result = await db.query(
            `INSERT INTO PRODUCTOS (nombre_producto, id_categoria, descripcion, precio, stock, imagen_url, estado, modificado_por, nombre_marca, id_proveedor)
             VALUES ($1, $2, $3, $4, $5, $6, 'Activo', $7, $8, $9);
             SELECT @@IDENTITY as insert_id;`,
            [nombre, categoria_id, descripcion || '', precio_base, stock || 0, imagen_url || '', modificado_por || null, marca || '', id_proveedor]
        );

        const insertedId = result.rows[0] ? result.rows[0].insert_id : null;

        // Registrar acción en auditoría
        if (modificado_por) {
            await registrarAuditoria(
                modificado_por, 
                'CREAR_PRODUCTO', 
                'PRODUCTOS', 
                insertedId, 
                `Creó el producto "${nombre}" (Marca: ${marca}), Stock: ${stock}, Precio: S/. ${precio_base}`
            );
        }

        res.json({ success: true, message: 'Producto creado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al crear producto' });
    }
});

// Actualizar Producto
app.put('/api/productos/:id', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, categoria_id, descripcion, precio_base, stock, imagen_url, modificado_por, marca } = req.body;
        
        await db.query(
            `UPDATE PRODUCTOS 
             SET nombre_producto=$1, id_categoria=$2, descripcion=$3, precio=$4, stock=$5, imagen_url=$6, nombre_marca=$7
             WHERE ID_producto=$8`,
            [nombre, categoria_id, descripcion || '', precio_base, stock, imagen_url || '', marca || '', id]
        );

        // Registrar acción en auditoría
        if (modificado_por) {
            await registrarAuditoria(
                modificado_por, 
                'MODIFICAR_PRODUCTO', 
                'PRODUCTOS', 
                id, 
                `Actualizó el producto "${nombre}" (Marca: ${marca}), Stock: ${stock}, Precio Base: S/. ${precio_base}`
            );
        }

        res.json({ success: true, message: 'Producto actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al actualizar producto' });
    }
});

// Eliminar Producto (Lógico)
app.delete('/api/productos/:id', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId || 1;

        await db.query("UPDATE PRODUCTOS SET estado = 'Eliminado' WHERE ID_producto=$1", [id]);

        await registrarAuditoria(userId, 'ELIMINAR_PRODUCTO', 'PRODUCTOS', id, `Eliminó lógicamente el producto con ID: ${id}`);

        res.json({ success: true, message: 'Producto eliminado (lógicamente)' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al eliminar producto' });
    }
});

// --- APIS DE VENTAS Y CHECKOUT ---

// Registrar venta
app.post('/api/ventas', requerirAutenticacion, async (req, res) => {
    const client = await db.connect();
    try {
        const { cliente_id, total_venta, metodo_pago, direccion_envio, detalles, tipo_entrega, costo_envio, dni_cliente } = req.body;
        
        // Validar que el cuerpo de la petición contenga detalles válidos
        if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
            return res.status(400).json({ success: false, message: 'El carrito de detalles está vacío o es inválido.' });
        }

        // Validar el stock de cada producto antes de iniciar la transacción
        for (let item of detalles) {
            const prodRes = await client.query('SELECT stock, nombre_producto FROM PRODUCTOS WHERE ID_producto = $1', [item.id]);
            if (prodRes.rows.length === 0) {
                return res.status(404).json({ success: false, message: `El producto con ID ${item.id} no existe.` });
            }
            const actualStock = prodRes.rows[0].stock;
            const quantity = item.quantity !== undefined ? item.quantity : item.cantidad;
            if (actualStock < quantity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Stock insuficiente para "${prodRes.rows[0].nombre_producto}". Disponible: ${actualStock}, solicitado: ${quantity}` 
                });
            }
        }

        const codigo_boleta = 'ORD-' + Math.floor(Math.random() * 9000 + 1000); 
        
        await client.query('BEGIN');
        
        const igv_tasa = 0.18;
        const subtotal = parseFloat(total_venta) / (1 + igv_tasa);
        const igv_aplicado = parseFloat(total_venta) - subtotal;
        
        const id_usuario_sistema = 1; // ID de administrador asignado a ventas online

        const resultVenta = await client.query(
            `INSERT INTO VENTAS (codigo_venta, id_cliente, id_usuario, subtotal, igv_aplicado, monto_total, tipo_entrega, costo_envio, estado_venta, metodo_pago, direccion_envio, estado_logistico, dni_cliente)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Completada', $9, $10, 'En espera', $11);
             SELECT @@IDENTITY as insert_id;`,
            [codigo_boleta, cliente_id, id_usuario_sistema, subtotal.toFixed(2), igv_aplicado.toFixed(2), total_venta, tipo_entrega || 'delivery', costo_envio || 0, metodo_pago || 'Efectivo', direccion_envio || '', dni_cliente || '']
        );
        const venta_id = resultVenta.rows[0] ? resultVenta.rows[0].insert_id : null;

        for (let item of detalles) {
            const quantity = item.quantity !== undefined ? item.quantity : item.cantidad;
            const price = item.price !== undefined ? item.price : item.precio;
            const name = item.name || item.nombre || 'Producto';

            const precio_neto = parseFloat(price) / 1.18;
            await client.query(
                `INSERT INTO DETALLE_VENTA (id_venta, id_producto, cantidad, precio_unitario_neto, nombre_producto, estado, subtotal)
                 VALUES ($1, $2, $3, $4, $5, 'Completo', $6)`,
                [venta_id, item.id, quantity, precio_neto.toFixed(2), name, (precio_neto * quantity).toFixed(2)]
            );
            await client.query(
                `UPDATE PRODUCTOS SET stock = stock - $1 WHERE ID_producto = $2`,
                [quantity, item.id]
            );
        }

        await client.query('COMMIT');
        res.json({ success: true, codigo_boleta, venta_id });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar venta:', error);
        res.status(500).json({ success: false, message: 'Error al registrar la venta' });
    } finally {
        client.release();
    }
});

// Obtener todas las ventas
app.get('/api/ventas', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT v.id_venta as id, v.codigo_venta as codigo_boleta, v.id_cliente as cliente_id, 
                   v.fecha_venta as fecha_compra, v.monto_total as total_venta, v.metodo_pago, 
                   v.estado_venta as estado_pedido, v.direccion_envio, v.costo_envio, v.tipo_entrega,
                   v.estado_logistico,
                   (c.nombres + ' ' + c.apellidos) as cliente_nombre
            FROM VENTAS v 
            LEFT JOIN CLIENTES c ON v.id_cliente = c.ID_Clientes 
            ORDER BY v.fecha_venta DESC
        `);
        res.json({ success: true, ventas: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener ventas' });
    }
});

// Obtener detalles de una venta
app.get('/api/ventas/detalle/:codigo', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    const { codigo } = req.params;
    try {
        const ventaRes = await db.query(`
            SELECT v.id_venta as id, v.codigo_venta as codigo_boleta, v.id_cliente as cliente_id, 
                   v.fecha_venta as fecha_compra, v.monto_total as total_venta, v.metodo_pago, 
                   v.estado_venta as estado_pedido, v.direccion_envio, v.costo_envio, v.tipo_entrega,
                   v.estado_logistico, v.dni_cliente,
                   (c.nombres + ' ' + c.apellidos) as cliente_nombre 
            FROM VENTAS v 
            LEFT JOIN CLIENTES c ON v.id_cliente = c.ID_Clientes 
            WHERE v.codigo_venta = $1`, 
            [codigo]
        );
        
        if (ventaRes.rows.length === 0) return res.status(404).json({ success: false, message: 'Venta no encontrada' });

        const venta = ventaRes.rows[0];

        const productosRes = await db.query(`
            SELECT id_detalle as id, id_venta as venta_id, id_producto as producto_id, cantidad, 
                   precio_unitario_neto as precio_unitario, subtotal, nombre_producto 
            FROM DETALLE_VENTA 
            WHERE id_venta = $1`, 
            [venta.id]
        );

        res.json({ 
            success: true, 
            venta: venta,
            productos: productosRes.rows 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// Confirmar Entrega Logística
app.post('/api/ventas/actualizar-logistica', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    const { codigo, estado } = req.body;
    try {
        await db.query(
            'UPDATE VENTAS SET estado_logistico = $1 WHERE codigo_venta = $2',
            [estado, codigo]
        );
        res.json({ success: true, message: 'Estado logístico actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al actualizar estado' });
    }
});

// Obtener compras por cliente
app.get('/api/ventas/cliente/:clienteId', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id_venta as id, codigo_venta as codigo_boleta, id_cliente as cliente_id, 
                   fecha_venta as fecha_compra, monto_total as total_venta, metodo_pago, 
                   estado_venta as estado_pedido, direccion_envio, tipo_entrega, costo_envio 
            FROM VENTAS 
            WHERE id_cliente = $1 
            ORDER BY id_venta DESC
        `, [req.params.clienteId]);
        
        const ventas = result.rows;
        
        for (let i = 0; i < ventas.length; i++) {
            const detallesResult = await db.query(`
                SELECT dv.id_detalle as id, dv.id_venta as venta_id, dv.id_producto as producto_id, 
                       dv.cantidad, dv.precio_unitario_neto as precio_unitario, dv.subtotal, 
                       dv.nombre_producto as producto_nombre, p.imagen_url as img
                FROM DETALLE_VENTA dv 
                JOIN PRODUCTOS p ON dv.id_producto = p.ID_producto 
                WHERE dv.id_venta = $1
            `, [ventas[i].id]);
            ventas[i].items = detallesResult.rows;
        }
        res.json({ success: true, ventas: ventas });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// Anular Venta Completa
app.post('/api/ventas/anular', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    const { id, motivo } = req.body;
    const userId = req.session.userId || 1;
    try {
        await db.query(
            "UPDATE VENTAS SET estado_venta = 'Anulado', motivo_anulacion = $1 WHERE id_venta = $2",
            [motivo || 'Devolución técnica', id]
        );

        await registrarAuditoria(userId, 'ANULAR_VENTA', 'VENTAS', id, `Anuló completamente la venta ID: ${id}. Motivo: ${motivo}`);

        res.json({ success: true, message: 'Venta anulada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al anular venta' });
    }
});

// Devolución Parcial (Mermas)
app.post('/api/ventas/anular-parcial', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    const { venta_id, items, motivo } = req.body;
    const userId = req.session.userId || 1;
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        
        let totalRestar = 0;
        for (let itemId of items) {
            const itemRes = await client.query('SELECT subtotal FROM DETALLE_VENTA WHERE id_detalle = $1', [itemId]);
            if (itemRes.rows.length > 0) {
                totalRestar += parseFloat(itemRes.rows[0].subtotal);
                await client.query(
                    "UPDATE DETALLE_VENTA SET estado = 'Defectuoso', motivo_falla = $1 WHERE id_detalle = $2",
                    [motivo, itemId]
                );
            }
        }

        await client.query(
            "UPDATE VENTAS SET monto_total = monto_total - $1, estado_venta = 'Parcialmente Anulado' WHERE id_venta = $2",
            [totalRestar, venta_id]
        );

        await client.query('COMMIT');

        await registrarAuditoria(userId, 'ANULAR_PARCIAL', 'VENTAS', venta_id, `Realizó devolución parcial en venta ID: ${venta_id}. Productos afectados: [${items.join(', ')}]. Motivo: ${motivo}`);

        res.json({ success: true, message: 'Devolución parcial procesada' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(error);
        res.status(500).json({ success: false, message: 'Error en devolución parcial' });
    } finally {
        client.release();
    }
});

// Estadísticas: Ventas por Categoría
app.get('/api/stats/sales-by-category', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const query = `
            SELECT c.nombre_categoria AS categoria, SUM(dv.subtotal) AS total
            FROM DETALLE_VENTA dv
            INNER JOIN PRODUCTOS p ON dv.id_producto = p.ID_producto
            INNER JOIN CATEGORIAS c ON p.id_categoria = c.id_categoria
            GROUP BY c.nombre_categoria
        `;
        const result = await db.query(query);
        res.json({ success: true, stats: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Obtener todas las mermas registradas
app.get('/api/mermas', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        const result = await db.query(`
            SELECT m.id_merma as id, m.cantidad, m.tipo_merma, m.costo_perdida as subtotal, 
                   m.descripcion as motivo_falla, m.fecha_registro as fecha_compra,
                   p.nombre_producto, p.nombre_marca as marca,
                   (u.nombres + ' ' + u.apellidos) as cliente_nombre
            FROM MERMAS m
            JOIN PRODUCTOS p ON m.id_producto = p.ID_producto
            JOIN USUARIOS u ON m.id_usuario = u.id_usuario
            ORDER BY m.fecha_registro DESC
        `);
        res.json({ success: true, mermas: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener mermas' });
    }
});

// Registrar una nueva merma y descontar stock
app.post('/api/mermas', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    const client = await db.connect();
    try {
        const { id_producto, cantidad, tipo_merma, descripcion, id_usuario } = req.body;
        const actorId = id_usuario || req.session.userId || 1;

        if (!id_producto || !cantidad || !tipo_merma) {
            return res.status(400).json({ success: false, message: 'Faltan datos requeridos.' });
        }

        // Obtener el precio base y stock actual del producto
        const prodResult = await client.query('SELECT precio, stock, nombre_producto FROM PRODUCTOS WHERE ID_producto = $1', [id_producto]);
        if (prodResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
        }

        const product = prodResult.rows[0];
        if (product.stock < cantidad) {
            return res.status(400).json({ success: false, message: `Stock insuficiente. Stock disponible: ${product.stock}` });
        }

        const costo_perdida = parseFloat(product.precio) * parseInt(cantidad);

        await client.query('BEGIN');

        // Insertar registro de merma
        await client.query(`
            INSERT INTO MERMAS (id_producto, id_usuario, cantidad, tipo_merma, costo_perdida, descripcion)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [id_producto, actorId, cantidad, tipo_merma, costo_perdida, descripcion || '']);

        // Descontar stock del producto
        await client.query(`
            UPDATE PRODUCTOS SET stock = stock - $1 WHERE ID_producto = $2
        `, [cantidad, id_producto]);

        await client.query('COMMIT');

        // Registrar auditoría
        await registrarAuditoria(
            actorId,
            'REGISTRAR_MERMA',
            'MERMAS',
            id_producto,
            `Reporto merma de ${cantidad} unidades de "${product.nombre_producto}". Motivo: ${tipo_merma}. Costo perdida: S/. ${costo_perdida.toFixed(2)}`
        );

        res.json({ success: true, message: 'Merma registrada con éxito y stock descontado.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al registrar merma:', error);
        res.status(500).json({ success: false, message: 'Error al procesar la merma.' });
    } finally {
        client.release();
    }
});

// Eliminar venta
app.delete('/api/ventas/:id', requerirRol(['Administrador', 'Empleado']), async (req, res) => {
    try {
        await db.query('DELETE FROM VENTAS WHERE id_venta=$1', [req.params.id]);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// --- APIS DE USUARIOS Y PERSONAL ---

// Obtener usuarios o clientes
app.get('/api/usuarios', requerirRol(['Administrador']), async (req, res) => {
    try {
        const { rol } = req.query;
        let query = "";
        let params = [];
        
        if (rol === 'Cliente') {
            query = `SELECT ID_Clientes as id, num_dni as dni, nombres, apellidos, 
                            (nombres + ' ' + apellidos) as nombre_completo, num_celular as celular, 
                            correo as email, estado_cliente as estado, correo as username,
                            fecha_nacimiento as birthdate, direccion 
                     FROM CLIENTES 
                     ORDER BY ID_Clientes DESC`;
        } else {
            query = `SELECT id_usuario as id, nombre_usuario as username, nombres, apellidos, 
                            (nombres + ' ' + apellidos) as nombre_completo, num_dni as dni, 
                            num_celular as celular, correo as email, contrasena as password, 
                            rol, estado 
                     FROM USUARIOS 
                     ORDER BY id_usuario DESC`;
        }
        
        const result = await db.query(query, params);
        res.json({ success: true, usuarios: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// Crear Personal Interno
app.post('/api/usuarios', requerirRol(['Administrador']), async (req, res) => {
    try {
        const { codigo_interno, nombre_completo, username, email, dni, celular, password, rol } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const nameParts = nombre_completo.trim().split(' ');
        const nombres = nameParts[0] || '';
        const apellidos = nameParts.slice(1).join(' ') || 'Apellidos';
        const dbRol = rol === 'Admin' ? 'Administrador' : 'Empleado';
        const actorId = req.session.userId || 1;

        await db.query(
            `INSERT INTO USUARIOS (nombre_usuario, nombres, apellidos, num_dni, num_celular, correo, contrasena, rol, estado)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Activo')`,
            [username, nombres, apellidos, dni, celular, email, hashedPassword, dbRol]
        );

        await registrarAuditoria(actorId, 'CREAR_USUARIO', 'USUARIOS', null, `Creó el usuario de personal "${username}" (${nombres} ${apellidos}) con rol: ${dbRol}`);

        res.json({ success: true, message: 'Usuario creado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al crear usuario' });
    }
});

// Actualizar Clientes o Personal
app.put('/api/usuarios/:id', requerirRol(['Administrador']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombres, apellidos, nombre_completo, username, email, dni, celular, direccion_zona, fecha_nacimiento, rol, password, estado } = req.body;
        const actorId = req.session.userId || 1;
        
        if (rol === 'Cliente') {
            let finalNombres = nombres;
            let finalApellidos = apellidos;
            if (!finalNombres || !finalApellidos) {
                const nameParts = (nombre_completo || '').trim().split(' ');
                finalNombres = nameParts[0] || '';
                finalApellidos = nameParts.slice(1).join(' ') || 'Apellidos';
            }
            
            if (password && password.trim() !== '') {
                const hashedPassword = await bcrypt.hash(password, 10);
                await db.query(
                    `UPDATE CLIENTES SET nombres=$1, apellidos=$2, correo=$3, num_celular=$4, contrasena=$5, estado_cliente=$6, num_dni=$7, fecha_nacimiento=$8, direccion=$9 WHERE ID_Clientes=$10`,
                    [finalNombres, finalApellidos, email, celular, hashedPassword, estado || 'Activo', dni, fecha_nacimiento || null, direccion_zona || '', id]
                );
            } else {
                await db.query(
                    `UPDATE CLIENTES SET nombres=$1, apellidos=$2, correo=$3, num_celular=$4, estado_cliente=$5, num_dni=$6, fecha_nacimiento=$7, direccion=$8 WHERE ID_Clientes=$9`,
                    [finalNombres, finalApellidos, email, celular, estado || 'Activo', dni, fecha_nacimiento || null, direccion_zona || '', id]
                );
            }
            await registrarAuditoria(actorId, 'MODIFICAR_USUARIO', 'CLIENTES', id, `Modificó el perfil del cliente "${nombres} ${apellidos}"`);
        } else {
            const nameParts = nombre_completo.trim().split(' ');
            const nombres = nameParts[0] || '';
            const apellidos = nameParts.slice(1).join(' ') || 'Apellidos';
            const dbRol = rol === 'Admin' ? 'Administrador' : 'Empleado';
            
            if (password && password.trim() !== '') {
                const hashedPassword = await bcrypt.hash(password, 10);
                await db.query(
                    `UPDATE USUARIOS SET nombres=$1, apellidos=$2, nombre_usuario=$3, correo=$4, num_dni=$5, num_celular=$6, contrasena=$7, rol=$8, estado=$9 WHERE id_usuario=$10`,
                    [nombres, apellidos, username, email, dni, celular, hashedPassword, dbRol, estado || 'Activo', id]
                );
            } else {
                await db.query(
                    `UPDATE USUARIOS SET nombres=$1, apellidos=$2, nombre_usuario=$3, correo=$4, num_dni=$5, num_celular=$6, rol=$7, estado=$8 WHERE id_usuario=$9`,
                    [nombres, apellidos, username, email, dni, celular, dbRol, estado || 'Activo', id]
                );
            }
            await registrarAuditoria(actorId, 'MODIFICAR_USUARIO', 'USUARIOS', id, `Modificó el perfil del trabajador "${username}"`);
        }
        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al actualizar usuario' });
    }
});

// Eliminar Cliente o Personal
app.delete('/api/usuarios/:id', requerirRol(['Administrador']), async (req, res) => {
    try {
        const { id } = req.params;
        const actorId = req.session.userId || 1;

        // Intentar eliminar primero de clientes
        const deleteClientResult = await db.query('DELETE FROM CLIENTES WHERE ID_Clientes = $1', [id]);
        
        if (deleteClientResult.rowCount > 0) {
            await registrarAuditoria(actorId, 'ELIMINAR_USUARIO', 'CLIENTES', id, `Eliminó la cuenta del cliente ID: ${id}`);
        } else {
            // Si no afectó nada, eliminar de usuarios (personal)
            await db.query('DELETE FROM USUARIOS WHERE id_usuario = $1', [id]);
            await registrarAuditoria(actorId, 'ELIMINAR_USUARIO', 'USUARIOS', id, `Eliminó la cuenta del empleado ID: ${id}`);
        }
        
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al eliminar usuario' });
    }
});

// --- API AUDITORÍA ---
app.get('/api/auditoria', requerirRol(['Administrador']), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT a.id_auditoria, a.id_usuario, a.accion, a.tabla_afectada, a.registro_id, a.detalles, a.fecha_accion,
                    u.nombre_usuario, u.nombres, u.apellidos
             FROM AUDITORIA a
             JOIN USUARIOS u ON a.id_usuario = u.id_usuario
             ORDER BY a.fecha_accion DESC`
        );
        res.json({ success: true, logs: result.rows });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al obtener bitácora de auditoría' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
