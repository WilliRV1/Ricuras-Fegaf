-- Migration: Crear tabla arqueos_caja para manejo de dinero y turnos

CREATE TABLE IF NOT EXISTS public.arqueos_caja (
  id SERIAL PRIMARY KEY,
  base_inicial NUMERIC NOT NULL,
  estado VARCHAR(20) DEFAULT 'abierto' NOT NULL CHECK (estado IN ('abierto', 'cerrado')),
  opened_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  closed_at TIMESTAMPTZ,
  total_efectivo NUMERIC DEFAULT 0,
  total_transferencias NUMERIC DEFAULT 0
);

COMMENT ON TABLE public.arqueos_caja IS 'Registro de turnos y cuadre de caja (base inicial y cierres)';
