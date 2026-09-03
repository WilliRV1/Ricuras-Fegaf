import { LiquidacionBoard } from '@/components/liquidacion/LiquidacionBoard';
import { ToastContainer } from '@/components/ui/Toast';
import { IconBanknote } from '@/components/ui/Icons';

export const metadata = {
  title: 'Liquidación | Ricuras FegaF',
};

export default function LiquidacionPage() {
  return (
    <main style={{ padding: '16px 24px', minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IconBanknote size={26} color="var(--color-primary)" />
            Liquidación de Cuentas
          </h1>
          <p style={{ color: 'var(--color-text-muted)', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
            Selecciona el método de pago para cobrar las órdenes listas.
          </p>
        </div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Caja (Realtime)
        </div>
      </header>
      
      <LiquidacionBoard />
      
      <ToastContainer />
    </main>
  );
}
