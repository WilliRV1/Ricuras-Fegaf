-- Archivo Seed: Categorías y productos completos de Ricuras Fegaf

-- 0. Limpiar datos existentes
TRUNCATE TABLE public.categorias, public.productos CASCADE;

-- 1. Insertar categorías (ignora las que ya existan)
INSERT INTO public.categorias (nombre, orden) VALUES
('Salchipapas', 1),
('Arepas', 2),
('Asados', 3),
('Perros Calientes', 4),
('Aplastados', 5),
('Hamburguesas', 6),
('Bebidas', 7),
('Adicionales', 8)
ON CONFLICT (nombre) DO NOTHING;

-- Función anónima para insertar los productos asociando dinámicamente la categoría
DO $$
DECLARE
    cat_salchipapas INT;
    cat_arepas INT;
    cat_asados INT;
    cat_perros INT;
    cat_aplastados INT;
    cat_hamburguesas INT;
    cat_bebidas INT;
    cat_adicionales INT;
BEGIN
    SELECT id INTO cat_salchipapas FROM public.categorias WHERE nombre = 'Salchipapas';
    SELECT id INTO cat_arepas FROM public.categorias WHERE nombre = 'Arepas';
    SELECT id INTO cat_asados FROM public.categorias WHERE nombre = 'Asados';
    SELECT id INTO cat_perros FROM public.categorias WHERE nombre = 'Perros Calientes';
    SELECT id INTO cat_aplastados FROM public.categorias WHERE nombre = 'Aplastados';
    SELECT id INTO cat_hamburguesas FROM public.categorias WHERE nombre = 'Hamburguesas';
    SELECT id INTO cat_bebidas FROM public.categorias WHERE nombre = 'Bebidas';
    SELECT id INTO cat_adicionales FROM public.categorias WHERE nombre = 'Adicionales';

    -- 2. Insertar Productos (activo=true, es_adicion=false por defecto)
    
    -- SALCHIPAPAS
    INSERT INTO public.productos (nombre, precio, categoria_id, activo, es_adicion) VALUES
    ('Salchipapa Sencilla', 15000, cat_salchipapas, true, false),
    ('Salchipapa Salchi Pollo', 23000, cat_salchipapas, true, false),
    ('Salchipapa Salchi Pollo y Tocineta', 28000, cat_salchipapas, true, false),
    ('Salchipapa Salchi Mega (para dos)', 43000, cat_salchipapas, true, false),
    ('Salchipapa Maicitos', 28000, cat_salchipapas, true, false);

    -- AREPAS
    INSERT INTO public.productos (nombre, precio, categoria_id, activo, es_adicion) VALUES
    ('Arepa pollo', 17000, cat_arepas, true, false),
    ('Arepa pollo y tocineta', 20000, cat_arepas, true, false),
    ('Arepa hamburguesa', 17000, cat_arepas, true, false),
    ('Arepa Hamburguesa y tocineta', 20000, cat_arepas, true, false);

    -- ASADOS
    INSERT INTO public.productos (nombre, precio, categoria_id, activo, es_adicion) VALUES
    ('PICADA TRES CARNES', 48000, cat_asados, true, false),
    ('PICADA CUATRO CARNES', 53000, cat_asados, true, false),
    ('PICADA PERSONAL', 28000, cat_asados, true, false),
    ('PARRILLA MIX', 26000, cat_asados, true, false),
    ('BROCHETA POLLO', 18000, cat_asados, true, false),
    ('BROCHETA CERDO', 18000, cat_asados, true, false),
    ('BROCHETA RES', 20000, cat_asados, true, false),
    ('CHORIZO DE CERDO', 15000, cat_asados, true, false),
    ('CHURRASCO 200 gr', 27000, cat_asados, true, false),
    ('CHURRASCO 250 gr', 30000, cat_asados, true, false),
    ('FILETE DE POLLO', 25000, cat_asados, true, false);

    -- PERROS CALIENTES
    INSERT INTO public.productos (nombre, precio, categoria_id, activo, es_adicion) VALUES
    ('Perro Clasico', 16000, cat_perros, true, false),
    ('Perro Clasico Combo', 25000, cat_perros, true, false),
    ('Perro Con Tocineta', 19000, cat_perros, true, false),
    ('Perro Con Tocineta Combo', 30000, cat_perros, true, false),
    ('COMBO X DOS CLÁSICOS', 50000, cat_perros, true, false),
    ('COMBO X DOS TOCINETA', 58000, cat_perros, true, false);

    -- APLASTADOS
    INSERT INTO public.productos (nombre, precio, categoria_id, activo, es_adicion) VALUES
    ('Aplastado CLASICO', 18000, cat_aplastados, true, false),
    ('Aplastado CLASICO Combo', 27000, cat_aplastados, true, false),
    ('Aplastado TOCINETA', 22000, cat_aplastados, true, false),
    ('Aplastado TOCINETA Combo', 31000, cat_aplastados, true, false);

    -- HAMBURGUESAS
    INSERT INTO public.productos (nombre, precio, categoria_id, activo, es_adicion) VALUES
    ('Hamburguesa CLASICA', 18000, cat_hamburguesas, true, false),
    ('Hamburguesa CLASICA Combo', 27000, cat_hamburguesas, true, false),
    ('Hamburguesa TOCINETA', 22000, cat_hamburguesas, true, false),
    ('Hamburguesa TOCINETA Combo', 31000, cat_hamburguesas, true, false),
    ('Hamburguesa MAX DOBLE CARNE', 29000, cat_hamburguesas, true, false),
    ('Hamburguesa MAX DOBLE CARNE Combo', 38000, cat_hamburguesas, true, false),
    ('COMBO X DOS CLASICAS', 55000, cat_hamburguesas, true, false),
    ('COMBO X DOS TOCINETA', 63000, cat_hamburguesas, true, false),
    ('COMBO X TRES CLASICAS', 78000, cat_hamburguesas, true, false),
    ('COMBO X TRES TOCINETA', 89000, cat_hamburguesas, true, false),
    ('COMBO X CUATRO CLASICAS', 100000, cat_hamburguesas, true, false),
    ('COMBO X CUATRO TOCINETA', 117000, cat_hamburguesas, true, false);

    -- BEBIDAS
    INSERT INTO public.productos (nombre, precio, categoria_id, activo, es_adicion) VALUES
    ('Gaseosa personal 400 ml', 5000, cat_bebidas, true, false),
    ('Gaseosa 1.5 Lt', 10000, cat_bebidas, true, false),
    ('Jugo Hit 500 ml', 5000, cat_bebidas, true, false),
    ('Jugos en agua', 7000, cat_bebidas, true, false),
    ('Jugos en Leche', 9000, cat_bebidas, true, false),
    ('Agua con gas', 3000, cat_bebidas, true, false);

    -- ADICIONALES (es_adicion = true)
    INSERT INTO public.productos (nombre, precio, categoria_id, activo, es_adicion) VALUES
    ('Carne de Hamburguesa', 10000, cat_adicionales, true, true),
    ('Pechuga a la plancha', 10000, cat_adicionales, true, true),
    ('Tocineta Artesanal', 8000, cat_adicionales, true, true),
    ('Chorizo de Cerdo', 10000, cat_adicionales, true, true),
    ('Papa Francesa 200 gr', 8000, cat_adicionales, true, true),
    ('Ensalada', 3000, cat_adicionales, true, true),
    ('Salchicha Kimby', 4000, cat_adicionales, true, true),
    ('Arepa de Maíz', 3000, cat_adicionales, true, true),
    ('Queso Mozarella (par)', 3000, cat_adicionales, true, true),
    ('Lata Maicitos', 6000, cat_adicionales, true, true);

END $$;
