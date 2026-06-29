const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function updateDb() {
    try {
        console.log("Iniciando actualización de base de datos...");
        await pool.query("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS dni_cliente VARCHAR(20);");
        console.log("¡Éxito! Columna 'dni_cliente' añadida a la tabla 'ventas'.");
        process.exit(0);
    } catch (err) {
        console.error("Error al actualizar:", err);
        process.exit(1);
    }
}

updateDb();
