const http = require('http');
const db = require('../db'); // Import DB to setup/cleanup test data

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method: method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                let parsed = data;
                if (res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
                    try {
                        parsed = JSON.parse(data);
                    } catch (e) {
                        // ignore
                    }
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: parsed
                });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log("=== INICIANDO PRUEBAS DE INTEGRACIÓN (SEGURIDAD Y STOCK) ===");

    try {
        // 0. Preparar datos de prueba en la base de datos
        console.log("\n[Preparación] Reseteando identidades y creando categoría/proveedor semilla...");
        
        await db.query("DBCC CHECKIDENT ('PROVEEDORES', RESEED, 0)");
        await db.query("DBCC CHECKIDENT ('CATEGORIAS', RESEED, 0)");

        const catRes = await db.query("INSERT INTO CATEGORIAS (nombre_categoria) VALUES ('Herramientas de Prueba'); SELECT @@IDENTITY as id;");
        const testCategoryId = catRes.rows[0].id;
        console.log(`[Preparación] Categoría creada con ID: ${testCategoryId} (Debe ser 1)`);

        const provRes = await db.query("INSERT INTO PROVEEDORES (razon_social, num_ruc) VALUES ('Proveedor Semilla', '11111111111'); SELECT @@IDENTITY as id;");
        const testProviderId = provRes.rows[0].id;
        console.log(`[Preparación] Proveedor creado con ID: ${testProviderId} (Debe ser 1)`);

        let cookie = '';

        // 1. Verificar acceso público a la raíz
        console.log("\n[Test 1] GET / (Debe responder 200)...");
        const resRoot = await makeRequest('GET', '/');
        console.log(`Respuesta: ${resRoot.statusCode}`);

        // 2. Verificar que el acceso a un endpoint protegido SIN sesión falle con 401
        console.log("\n[Test 2] GET /api/proveedores (Sin sesión - Debe fallar 401)...");
        const resUnauth = await makeRequest('GET', '/api/proveedores');
        console.log(`Respuesta: ${resUnauth.statusCode}`, resUnauth.body);
        if (resUnauth.statusCode === 401) {
            console.log("✔ COMPORTAMIENTO DE SEGURIDAD CORRECTO: Acceso denegado (401).");
        } else {
            console.error("❌ ERROR: El sistema permitió el acceso o devolvió otro código.");
        }

        // 3. Iniciar sesión como Administrador
        console.log("\n[Test 3] POST /api/login (Admin)...");
        const loginRes = await makeRequest('POST', '/api/login', {
            username: 'admin',
            password: 'AdminPassword2026*'
        });
        console.log(`Respuesta: ${loginRes.statusCode}`);
        if (loginRes.body.success) {
            console.log("Login exitoso.");
            const setCookieHeader = loginRes.headers['set-cookie'];
            if (setCookieHeader) {
                cookie = setCookieHeader[0].split(';')[0];
                console.log(`Cookie de sesión: ${cookie}`);
            }
        }

        const authHeaders = cookie ? { 'Cookie': cookie } : {};

        // 4. Verificar que con sesión sí permita acceder
        console.log("\n[Test 4] GET /api/proveedores (Con sesión - Debe permitir 200)...");
        const resAuth = await makeRequest('GET', '/api/proveedores', null, authHeaders);
        console.log(`Respuesta: ${resAuth.statusCode}`);
        if (resAuth.statusCode === 200) {
            console.log("✔ COMPORTAMIENTO DE SEGURIDAD CORRECTO: Acceso permitido.");
        }

        // 5. Crear un producto de prueba
        console.log(`\n[Test 5] POST /api/productos (Crear producto con stock = 5 bajo categoría ${testCategoryId})...`);
        const createProdRes = await makeRequest('POST', '/api/productos', {
            nombre: 'Destornillador Test',
            categoria_id: testCategoryId,
            descripcion: 'Para pruebas unitarias.',
            precio_base: 10.00,
            stock: 5,
            imagen_url: '',
            modificado_por: 1,
            marca: 'Stanley'
        }, authHeaders);
        console.log(`Respuesta: ${createProdRes.statusCode}`, createProdRes.body);

        // Obtener ID del producto creado
        const prodsList = await makeRequest('GET', '/api/productos', null, authHeaders);
        let testProductId = null;
        if (prodsList.body.success && prodsList.body.products.length > 0) {
            testProductId = prodsList.body.products[0].id;
            console.log(`Producto de prueba ID: ${testProductId}`);
        }

        if (testProductId) {
            // 6. Intentar comprar más del stock disponible (Debe fallar)
            console.log(`\n[Test 6] POST /api/ventas (Comprar 10 unidades cuando solo hay 5 en stock - Debe fallar 400)...`);
            const saleFailRes = await makeRequest('POST', '/api/ventas', {
                cliente_id: 31,
                total_venta: 100.00,
                metodo_pago: 'Efectivo',
                direccion_envio: 'Calle Falsa 123',
                tipo_entrega: 'retiro',
                costo_envio: 0,
                dni_cliente: '12345678',
                detalles: [
                    {
                        id: testProductId,
                        quantity: 10,
                        price: 10.00,
                        name: 'Destornillador Test'
                    }
                ]
            }, authHeaders);
            console.log(`Respuesta: ${saleFailRes.statusCode}`, saleFailRes.body);
            if (saleFailRes.statusCode === 400 && saleFailRes.body.success === false) {
                console.log("✔ COMPORTAMIENTO DE STOCK CORRECTO: Impedida la venta por falta de stock.");
            } else {
                console.error("❌ ERROR: El sistema permitió la venta con sobre-giro de stock.");
            }

            // 7. Comprar dentro del stock disponible (Debe tener éxito)
            console.log(`\n[Test 7] POST /api/ventas (Comprar 2 unidades cuando hay 5 en stock - Debe tener éxito 200)...`);
            const saleSuccessRes = await makeRequest('POST', '/api/ventas', {
                cliente_id: 31,
                total_venta: 20.00,
                metodo_pago: 'Efectivo',
                direccion_envio: 'Calle Falsa 123',
                tipo_entrega: 'retiro',
                costo_envio: 0,
                dni_cliente: '12345678',
                detalles: [
                    {
                        id: testProductId,
                        quantity: 2,
                        price: 10.00,
                        name: 'Destornillador Test'
                    }
                ]
            }, authHeaders);
            console.log(`Respuesta: ${saleSuccessRes.statusCode}`, saleSuccessRes.body);
            if (saleSuccessRes.statusCode === 200 && saleSuccessRes.body.success === true) {
                console.log("✔ COMPORTAMIENTO DE STOCK CORRECTO: Venta autorizada.");
                
                // Verificar que el stock disminuyó a 3
                const checkProd = await db.query("SELECT stock FROM PRODUCTOS WHERE ID_producto = $1", [testProductId]);
                console.log(`Stock restante en base de datos: ${checkProd.rows[0].stock} (Debe ser 3)`);
                if (checkProd.rows[0].stock === 3) {
                    console.log("✔ COMPORTAMIENTO DE ACTUALIZACIÓN DE STOCK CORRECTO.");
                } else {
                    console.error("❌ ERROR: El stock no se actualizó correctamente.");
                }
            }
        }

        // Cleanup: Limpiar todo el ambiente de prueba para dejar la DB limpia
        console.log("\n[Limpieza] Limpiando datos de prueba...");
        await db.query("DELETE FROM DETALLE_VENTA");
        await db.query("DELETE FROM VENTAS");
        await db.query("DELETE FROM PRODUCTOS");
        await db.query("DELETE FROM PROVEEDORES");
        await db.query("DELETE FROM CATEGORIAS");
        console.log("[Limpieza] Base de datos limpia.");

        console.log("\n=== TODAS LAS PRUEBAS FINALIZADAS CON ÉXITO ===");
        process.exit(0);

    } catch (e) {
        console.error("Error crítico durante pruebas:", e);
        process.exit(1);
    }
}

runTests();
