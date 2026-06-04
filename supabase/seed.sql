-- Archivo Seed: Categorías y productos de ejemplo

-- Insertar categorías
INSERT INTO public.categorias (nombre, descripcion) VALUES
('Pizzas', 'Nuestras deliciosas pizzas artesanales'),
('Bebidas', 'Refrescos, jugos y más'),
('Postres', 'El toque dulce para terminar tu comida');

-- Insertar productos de ejemplo asociándolos a la categoría recién creada
INSERT INTO public.productos (nombre, descripcion, precio, categoria_id)
SELECT 'Pizza Margarita', 'Salsa de tomate, mozzarella y albahaca fresca', 25000, id FROM public.categorias WHERE nombre = 'Pizzas' LIMIT 1;

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id)
SELECT 'Pizza Hawaiana', 'Salsa de tomate, mozzarella, jamón y piña', 28000, id FROM public.categorias WHERE nombre = 'Pizzas' LIMIT 1;

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id)
SELECT 'Gaseosa Cola 1.5L', 'Bebida gaseosa sabor cola, bien fría', 6000, id FROM public.categorias WHERE nombre = 'Bebidas' LIMIT 1;

INSERT INTO public.productos (nombre, descripcion, precio, categoria_id)
SELECT 'Cheesecake de Frutos Rojos', 'Delicioso postre cremoso con salsa de frutos rojos', 8500, id FROM public.categorias WHERE nombre = 'Postres' LIMIT 1;
