const db = require('../db');

async function getDBInfo() {
    try {
        console.log("--- TABLAS EN LA BASE DE DATOS ---");
        const tables = await db.query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
        `);
        console.table(tables.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

getDBInfo();
