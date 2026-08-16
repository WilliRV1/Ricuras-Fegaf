/**
 * Formatea un número como moneda colombiana (COP)
 * Ejemplo: 15000 -> "$15.000"
 */
import { RECARGO_DATAFONO } from './constants';

/**
 * Calcula el recargo del datáfono (5%).
 * La base incluye el costo del domicilio, porque el datáfono cobra su comisión
 * sobre todo lo que se pasa por él, no solo sobre la comida.
 */
export function calcularRecargoDatafono(subtotal: number, costoDomicilio: number = 0): number {
  return Math.round((subtotal + costoDomicilio) * RECARGO_DATAFONO);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
