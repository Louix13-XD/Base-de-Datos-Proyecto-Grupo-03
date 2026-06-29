const fs = require('fs');
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://db_palacios_user:9tofVZ7SjaE3HaDPdL364bTWfn3UNVyt@dpg-d7tvu3vavr4c73d59icg-a.oregon-postgres.render.com/db_palacios',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Conectado a la base de datos PostgreSQL de Render...');
    
    const sql = fs.readFileSync('database_postgres.sql', 'utf8');
    await client.query(sql);
    
    console.log('¡Éxito! Todas las tablas, roles y el usuario admin fueron inyectados correctamente.');
  } catch (error) {
    console.error('Error al ejecutar el script:', error);
  } finally {
    await client.end();
  }
}

run();
