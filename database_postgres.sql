-- -----------------------------------------------------
-- Base de Datos: Ferre-Max (PostgreSQL)
-- Nota: En Render, la base de datos se crea automáticamente.
-- Solo debes copiar y pegar este script en la consola SQL de Render.
-- -----------------------------------------------------

-- 1. Crear Tipos ENUM (PostgreSQL requiere crear los ENUM por separado)
CREATE TYPE rol_usuario AS ENUM ('Admin', 'Supervisor', 'Trabajador_Ventas', 'Trabajador_Almacen', 'Cliente');
CREATE TYPE estado_usuario AS ENUM ('Activo', 'Inactivo');
CREATE TYPE estado_producto AS ENUM ('Activo', 'Oculto', 'Agotado');
CREATE TYPE estado_pedido_enum AS ENUM ('Pendiente', 'Procesando', 'En Camino', 'Entregado', 'Cancelado');

-- -----------------------------------------------------
-- 2. Tabla `usuarios`
-- -----------------------------------------------------
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  codigo_interno VARCHAR(50) NULL,
  nombre_completo VARCHAR(150) NOT NULL,
  username VARCHAR(50) UNIQUE NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  dni VARCHAR(8) NULL,
  celular VARCHAR(15) NULL,
  direccion_zona VARCHAR(255) NULL,
  password VARCHAR(255) NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'Cliente',
  estado estado_usuario NOT NULL DEFAULT 'Activo',
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- 3. Tabla `categorias`
-- -----------------------------------------------------
CREATE TABLE categorias (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL UNIQUE
);

-- -----------------------------------------------------
-- 4. Tabla `productos`
-- -----------------------------------------------------
CREATE TABLE productos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(150) NOT NULL,
  categoria_id INT NOT NULL,
  descripcion TEXT NULL,
  precio_base DECIMAL(10,2) NOT NULL,
  precio_final DECIMAL(10,2) NOT NULL,
  stock INT NOT NULL DEFAULT 0,
  marca VARCHAR(100) NULL,
  imagen_url VARCHAR(500) NULL,
  estado estado_producto NOT NULL DEFAULT 'Activo',
  modificado_por INT NULL,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  FOREIGN KEY (modificado_por) REFERENCES usuarios(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Función y Trigger para simular ON UPDATE de productos (Automático)
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.actualizado_en = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_actualizar_producto
BEFORE UPDATE ON productos
FOR EACH ROW
EXECUTE PROCEDURE actualizar_timestamp();

-- -----------------------------------------------------
-- 5. Tabla `favoritos`
-- -----------------------------------------------------
CREATE TABLE favoritos (
  usuario_id INT NOT NULL,
  producto_id INT NOT NULL,
  PRIMARY KEY (usuario_id, producto_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- 6. Tabla `ventas`
-- -----------------------------------------------------
CREATE TABLE ventas (
  id SERIAL PRIMARY KEY,
  codigo_boleta VARCHAR(50) NOT NULL UNIQUE,
  cliente_id INT NOT NULL,
  total_venta DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL,
  estado_pedido estado_pedido_enum NOT NULL DEFAULT 'Pendiente',
  direccion_envio VARCHAR(255) NULL,
  fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES usuarios(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- 7. Tabla `detalle_ventas`
-- -----------------------------------------------------
CREATE TABLE detalle_ventas (
  id SERIAL PRIMARY KEY,
  venta_id INT NOT NULL,
  producto_id INT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

-- -----------------------------------------------------
-- INSERCIÓN DE DATOS INICIALES (SEMILLAS)
-- -----------------------------------------------------
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

INSERT INTO categorias (nombre) VALUES 
('Herramientas'),
('Pintura'),
('Electricidad'),
('Plomería'),
('Construcción'),
('Jardinería');
