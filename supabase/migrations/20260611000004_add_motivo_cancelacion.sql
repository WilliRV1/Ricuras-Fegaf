-- Añadir motivo de cancelación a la tabla pedidos
ALTER TABLE pedidos ADD COLUMN motivo_cancelacion TEXT;
