-- -----------------------------------------------------
-- Base de Datos: Ferre-Max
-- -----------------------------------------------------
CREATE DATABASE IF NOT EXISTS ferremax_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ferremax_db;

-- -----------------------------------------------------
-- 1. Tabla `usuarios`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_interno VARCHAR(50) NULL COMMENT 'Ej: FP-TRBJ-0001 (Solo para personal)',
  nombre_completo VARCHAR(150) NOT NULL,
  username VARCHAR(50) UNIQUE NULL COMMENT 'Para login de personal',
  email VARCHAR(150) UNIQUE NOT NULL COMMENT 'Para login de clientes y notificaciones',
  dni VARCHAR(8) NULL,
  celular VARCHAR(15) NULL,
  direccion_zona VARCHAR(255) NULL,
  password VARCHAR(255) NOT NULL COMMENT 'Contraseña encriptada con bcrypt',
  rol ENUM('Admin', 'Supervisor', 'Trabajador_Ventas', 'Trabajador_Almacen', 'Cliente') NOT NULL DEFAULT 'Cliente',
  estado ENUM('Activo', 'Inactivo') NOT NULL DEFAULT 'Activo',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- 2. Tabla `categorias`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

-- -----------------------------------------------------
-- 3. Tabla `productos`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  categoria_id INT NOT NULL,
  descripcion TEXT NULL,
  precio_base DECIMAL(10,2) NOT NULL COMMENT 'Precio sin IGV',
  precio_final DECIMAL(10,2) NOT NULL COMMENT 'Precio con IGV',
  stock INT NOT NULL DEFAULT 0,
  imagen_url VARCHAR(500) NULL,
  estado ENUM('Activo', 'Oculto', 'Agotado') NOT NULL DEFAULT 'Activo',
  modificado_por INT NULL COMMENT 'ID del usuario que modificó por última vez',
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (modificado_por) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- 4. Tabla `favoritos`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id INT NOT NULL,
  producto_id INT NOT NULL,
  PRIMARY KEY (usuario_id, producto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- 5. Tabla `ventas`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo_boleta VARCHAR(50) NOT NULL UNIQUE COMMENT 'Ej: BOL-000452',
  cliente_id INT NOT NULL,
  total_venta DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL COMMENT 'Ej: Tarjeta, Yape, Plin',
  estado_pedido ENUM('Pendiente', 'Procesando', 'En Camino', 'Entregado', 'Cancelado') NOT NULL DEFAULT 'Pendiente',
  direccion_envio VARCHAR(255) NULL,
  fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- 6. Tabla `detalle_ventas`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS detalle_ventas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  venta_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL COMMENT 'Precio en el momento de la compra',
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- INSERCIÓN DE DATOS INICIALES (SEMILLAS)
-- -----------------------------------------------------

-- Insertar el super administrador solicitado
-- La contraseña 'admin123$$' ha sido encriptada usando bcrypt (costo 10)
INSERT INTO usuarios (codigo_interno, nombre_completo, username, email, dni, password, rol, estado) 
VALUES (
  'FP-ADMIN-0001', 
  'Administrador Principal', 
  'admin', 
  'admin@ferremax.com', 
  '00000000', 
  '$2b$10$6NXoYI32urH1np8rZdqDh.G1d5kXFRUIX2a2ntZzO7GLqdss022ca', 
  'Admin', 
  'Activo'
);

-- Insertar algunas categorías base
INSERT INTO categorias (nombre) VALUES 
('Herramientas Manuales'),
('Herramientas Eléctricas'),
('Pinturas y Acabados'),
('Construcción'),
('Electricidad e Iluminación'),
('Gasfitería');
