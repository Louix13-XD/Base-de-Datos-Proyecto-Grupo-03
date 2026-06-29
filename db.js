const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'FerreteriaPalacios',
    port: parseInt(process.env.DB_PORT) || 1433,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true', // Habilitado si DB_ENCRYPT=true (requerido para Azure)
        trustServerCertificate: true // Requerido para desarrollo local y Azure
    }
};
const pool = new sql.ConnectionPool(config);
const poolPromise = pool.connect()
    .then(p => {
        console.log('SQL Server Connected!');
        return p;
    })
    .catch(err => {
        console.error('SQL Server Connection Error:', err);
        process.exit(1);
    });

// Función auxiliar para formatear la consulta de PostgreSQL a SQL Server
async function runQuery(connectionOrTransaction, sqlText, params) {
    let formattedSql = sqlText;
    const request = new sql.Request(connectionOrTransaction);
    
    // Mapear parámetros posicionales ($1, $2, etc.) de PostgreSQL a SQL Server (@param1, @param2, etc.)
    if (params && Array.isArray(params)) {
        params.forEach((val, idx) => {
            const paramName = `param${idx + 1}`;
            request.input(paramName, val);
            
            // Expresión regular para reemplazar '$X' pero no '$X0'
            const regex = new RegExp('\\$' + (idx + 1) + '\\b', 'g');
            formattedSql = formattedSql.replace(regex, `@${paramName}`);
        });
    }
    
    // Ejecutar la consulta en SQL Server
    const result = await request.query(formattedSql);
    
    // Mapear el resultado para mantener compatibilidad con '.rows' y '.rows[0]' de 'pg'
    return {
        rows: result.recordset || [],
        rowCount: result.rowsAffected ? result.rowsAffected[0] : 0
    };
}

module.exports = {
    sql,
    poolPromise,
    query: async (text, params) => {
        const p = await poolPromise;
        return runQuery(p, text, params);
    },
    connect: async () => {
        const p = await poolPromise;
        let transaction = null;
        
        return {
            query: async (text, params) => {
                const cleanText = text.trim().toUpperCase();
                
                // Manejar control transaccional explícito nativo en el driver mssql
                if (cleanText === 'BEGIN') {
                    transaction = new sql.Transaction(p);
                    await transaction.begin();
                    return { rows: [], rowCount: 0 };
                } else if (cleanText === 'COMMIT') {
                    if (transaction) {
                        await transaction.commit();
                        transaction = null;
                    }
                    return { rows: [], rowCount: 0 };
                } else if (cleanText === 'ROLLBACK') {
                    if (transaction) {
                        await transaction.rollback();
                        transaction = null;
                    }
                    return { rows: [], rowCount: 0 };
                }
                
                return runQuery(transaction || p, text, params);
            },
            release: () => {
                if (transaction) {
                    transaction.rollback().catch(() => {});
                    transaction = null;
                }
            }
        };
    }
};
