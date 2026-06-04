-- Migration: Upgrade schema to match PROJECT.md (SERIAL IDs and missing columns)

-- Drop existing tables to recreate them cleanly (since we are in early dev phase)
DROP TABLE IF EXISTS public.detalle_pedidos CASCADE;
DROP TABLE IF EXISTS public.pedidos CASCADE;
DROP TABLE IF EXISTS public.productos CASCADE;
DROP TABLE IF EXISTS public.categorias CASCADE;

-- 1. Categorías
CREATE TABLE public.categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    orden INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Productos
CREATE TABLE public.productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    precio INT NOT NULL,
    categoria_id INT REFERENCES public.categorias(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true NOT NULL,
    es_adicion BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Pedidos
CREATE TABLE public.pedidos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('mesa', 'domicilio')),
    numero_mesa INT,
    cliente_nombre VARCHAR(200),
    cliente_telefono VARCHAR(20),
    cliente_direccion TEXT,
    estado VARCHAR(20) DEFAULT 'pendiente' NOT NULL,
    metodo_pago VARCHAR(20),
    subtotal INT NOT NULL DEFAULT 0,
    recargo INT NOT NULL DEFAULT 0,
    total INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    closed_at TIMESTAMPTZ
);

-- 4. Detalle de Pedidos
CREATE TABLE public.detalle_pedidos (
    id SERIAL PRIMARY KEY,
    pedido_id INT REFERENCES public.pedidos(id) ON DELETE CASCADE NOT NULL,
    producto_id INT REFERENCES public.productos(id) ON DELETE CASCADE NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario INT NOT NULL,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
