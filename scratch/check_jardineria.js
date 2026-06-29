const db = require('../db');

async function checkJardineria() {
    try {
        const result = await db.query('SELECT COUNT(*) FROM productos WHERE categoria_id = 6');
        console.log(`Productos en Jardinería (ID 6): ${result.rows[0].count}`);
        
        const samples = await db.query('SELECT id, nombre, estado, stock FROM productos WHERE categoria_id = 6 LIMIT 3');
        console.table(samples.rows);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkJardineria();
