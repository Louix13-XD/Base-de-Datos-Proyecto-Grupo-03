const db = require('../db');

async function check() {
    try {
        const ultimasVentas = await db.query("SELECT id, codigo_boleta FROM ventas ORDER BY id DESC LIMIT 5");
        console.log("Últimas 5 Ventas:", ultimasVentas.rows);

        for (let v of ultimasVentas.rows) {
            const detalles = await db.query("SELECT * FROM detalle_ventas WHERE venta_id = $1", [v.id]);
            console.log(`Detalles para Venta ID ${v.id} (${v.codigo_boleta}):`, detalles.rows);
        }
        process.exit(0);
    } catch(e) { console.error(e); process.exit(1); }
}
check();
