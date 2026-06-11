import { LiquidacionBoard } from '@/components/liquidacion/LiquidacionBoard';
import { ToastContainer } from '@/components/ui/Toast';

export default function LiquidacionPage() {
  return (
    <main style={{ padding: '2rem', color: 'var(--color-text)', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Liquidación de Cuentas</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Selecciona el método de pago para cobrar las órdenes listas.</p>
      </header>
      
      <LiquidacionBoard />
      
      <ToastContainer />
    </main>
  );
}
