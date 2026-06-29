const db = require('../db');

async function listUsers() {
    try {
        console.log("--- USUARIOS (Personal) ---");
        const users = await db.query('SELECT id_usuario, nombre_usuario, correo, contrasena, rol, estado FROM USUARIOS');
        console.table(users.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listUsers();
