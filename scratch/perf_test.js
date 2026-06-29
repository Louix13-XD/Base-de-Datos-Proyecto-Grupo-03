const sql = require('mssql');
require('dotenv').config();

const configIP = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    server: '127.0.0.1',
    database: process.env.DB_DATABASE || 'FerreteriaPalacios',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function run() {
    console.log("Iniciando prueba de consultas repetidas en un mismo pool...");
    const pool = new sql.ConnectionPool(configIP);
    await pool.connect();
    
    // Ejecutar 5 consultas consecutivas
    for(let i = 1; i <= 5; i++) {
        const start = Date.now();
        const result = await pool.query('SELECT TOP 5 * FROM PRODUCTOS');
        const diff = Date.now() - start;
        console.log(`Consulta ${i}: ${diff}ms (Productos: ${result.recordset.length})`);
    }
    
    await pool.close();
}

run();
