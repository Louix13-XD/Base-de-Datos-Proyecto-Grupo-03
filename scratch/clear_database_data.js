const db = require('../db');

async function clearData() {
    console.log("=== INICIANDO LIMPIEZA DE DATOS EN LA BASE DE DATOS ===");
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        console.log("Eliminando registros de DETALLE_VENTA...");
        await client.query('DELETE FROM DETALLE_VENTA');
        
        console.log("Eliminando registros de DETALLE_COMPRA_PROV...");
        await client.query('DELETE FROM DETALLE_COMPRA_PROV');
        
        console.log("Eliminando registros de MERMAS...");
        await client.query('DELETE FROM MERMAS');
        
        console.log("Eliminando registros de VENTAS...");
        await client.query('DELETE FROM VENTAS');
        
        console.log("Eliminando registros de COMPRAS_PROVEEDOR...");
        await client.query('DELETE FROM COMPRAS_PROVEEDOR');
        
        console.log("Eliminando registros de PRODUCTOS...");
        await client.query('DELETE FROM PRODUCTOS');
        
        console.log("Eliminando registros de PROVEEDORES...");
        await client.query('DELETE FROM PROVEEDORES');
        
        console.log("Eliminando registros de CATEGORIAS...");
        await client.query('DELETE FROM CATEGORIAS');
        
        console.log("Eliminando registros de AUDITORIA...");
        await client.query('DELETE FROM AUDITORIA');
        
        await client.query('COMMIT');
        console.log("=== LIMPIEZA COMPLETADA CON ÉXITO ===");
        console.log("Se conservaron los datos en USUARIOS y CLIENTES.");
        process.exit(0);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error durante la limpieza de datos:", error);
        process.exit(1);
    } finally {
        client.release();
    }
}

clearData();
