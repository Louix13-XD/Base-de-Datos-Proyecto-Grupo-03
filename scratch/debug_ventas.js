const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debugLogistica() {
    try {
        console.log("--- DIAGNÓSTICO DE PEDIDOS ---");
        const res = await pool.query("SELECT id, codigo_boleta, estado_logistico, tipo_entrega FROM ventas ORDER BY id DESC LIMIT 5");
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

debugLogistica();
