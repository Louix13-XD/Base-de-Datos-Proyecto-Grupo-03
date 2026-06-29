const db = require('../db');

async function updateSchema() {
    try {
        console.log("Actualizando esquema de ventas...");
        // Añadir columna de estado si no existe
        await db.query(`
            ALTER TABLE ventas 
            ADD COLUMN IF NOT EXISTS estado_pedido VARCHAR(50) DEFAULT 'Pagado',
            ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;
        `);
        console.log("Base de datos actualizada correctamente.");
        process.exit(0);
    } catch (err) {
        console.error("Error actualizando DB:", err);
        process.exit(1);
    }
}

updateSchema();
