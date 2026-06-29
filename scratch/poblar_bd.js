const fs = require('fs');
const path = require('path');
const sql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'FerreteriaPalacios',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Función auxiliar para limpiar sentencias SQL de cosas específicas de SSMS (como GO)
function limpiarSql(sqlText) {
    return sqlText
        .replace(/USE\s+FerreteriaPalacios\s*;?\s*/gi, '') // Quitar USE
        .replace(/\bGO\b/gi, '') // Quitar GO
        .replace(/BEGIN\s+TRANSACTION\s*;?\s*/gi, '') // Quitar transacciones manuales
        .replace(/COMMIT\s+TRANSACTION\s*;?\s*/gi, '')
        .trim();
}

async function poblarBaseDeDatos() {
    console.log('Iniciando proceso de población de datos base...');
    const pool = await sql.connect(config);
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();
        const request = new sql.Request(transaction);

        // 1. Limpieza de tablas en el orden correcto
        console.log('Limpiando tablas de datos anteriores...');
        const tablesToClear = [
            'DETALLE_COMPRA_PROV',
            'COMPRAS_PROVEEDOR',
            'DETALLE_VENTA',
            'VENTAS',
            'PRODUCTOS',
            'CATEGORIAS',
            'PROVEEDORES',
            'CLIENTES'
        ];

        for (const table of tablesToClear) {
            await request.query(`DELETE FROM ${table}`);
            await request.query(`DBCC CHECKIDENT ('${table}', RESEED, 0)`);
        }
        console.log('Tablas limpiadas y contadores de identidad reiniciados.');

        // 2. Cargar e insertar CATEGORIAS, CLIENTES y PROVEEDORES desde FerreteriaPalacios_Datos.sql
        console.log('Leyendo y limpiando FerreteriaPalacios_Datos.sql...');
        const datosPath = path.join(__dirname, '../../consultas/FerreteriaPalacios_Datos.sql');
        const datosSqlFull = fs.readFileSync(datosPath, 'utf8');

        // Separar para excluir la inserción de USUARIOS
        const partesDatos = datosSqlFull.split(/PRINT 'Cargando datos en USUARIOS/i);
        if (partesDatos.length < 2) {
            throw new Error('No se pudo encontrar la sección de USUARIOS en FerreteriaPalacios_Datos.sql');
        }

        // Ejecutar las categorías, clientes y proveedores juntos
        const sqlDatosBase = limpiarSql(partesDatos[0]);
        console.log('Ejecutando inserciones de Categorías, Clientes y Proveedores...');
        await request.query(sqlDatosBase);
        console.log('Categorías, Clientes y Proveedores insertados.');

        // 3. Cargar e insertar PRODUCTOS desde FerreteriaPalacios_Operaciones.sql
        console.log('Leyendo y limpiando FerreteriaPalacios_Operaciones.sql...');
        const opsPath = path.join(__dirname, '../../consultas/FerreteriaPalacios_Operaciones.sql');
        const opsSqlFull = fs.readFileSync(opsPath, 'utf8');

        // Separar para obtener únicamente la inserción de PRODUCTOS
        const partesOps = opsSqlFull.split(/PRINT 'Insertando Cabeceras de Ventas/i);
        if (partesOps.length < 2) {
            throw new Error('No se pudo encontrar la sección de Ventas en FerreteriaPalacios_Operaciones.sql');
        }

        const sqlProductos = limpiarSql(partesOps[0]);
        console.log('Ejecutando inserción de 300 Productos...');
        await request.query(sqlProductos);
        console.log('300 Productos insertados correctamente.');

        await transaction.commit();
        console.log('¡Base de datos poblada exitosamente con datos de prueba!');
    } catch (err) {
        console.error('Error durante la población de datos, revertiendo cambios:', err);
        try {
            await transaction.rollback();
        } catch (rollbackErr) {
            console.error('Error al hacer rollback:', rollbackErr);
        }
    } finally {
        await pool.close();
    }
}

poblarBaseDeDatos();
