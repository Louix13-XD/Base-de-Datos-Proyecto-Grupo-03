const db = require('../db');

async function checkCategories() {
    try {
        console.log("--- CATEGORÍAS EN DB ---");
        const cats = await db.query('SELECT * FROM categorias');
        console.table(cats.rows);

        console.log("\n--- ÚLTIMOS 5 PRODUCTOS CREADOS ---");
        const prods = await db.query(`
            SELECT p.id, p.nombre, c.nombre as categoria_nombre 
            FROM productos p 
            JOIN categorias c ON p.categoria_id = c.id 
            ORDER BY p.id DESC LIMIT 5
        `);
        console.table(prods.rows);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCategories();
