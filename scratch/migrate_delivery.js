const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log("Iniciando migración de logística en Render...");
        
        await pool.query(`
            ALTER TABLE ventas 
            ADD COLUMN IF NOT EXISTS tipo_entrega VARCHAR(20) DEFAULT 'recojo',
            ADD COLUMN IF NOT EXISTS costo_envio DECIMAL(10,2) DEFAULT 0.00,
            ADD COLUMN IF NOT EXISTS estado_logistico VARCHAR(20) DEFAULT 'En espera',
            ADD COLUMN IF NOT EXISTS direccion_entrega TEXT;
        `);

        console.log("✅ Base de datos actualizada con éxito en Render.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Error en la migración:", err);
        process.exit(1);
    }
}

migrate();
