import { OrderBoard } from '@/components/cocina/OrderBoard';
import { IconChefHat } from '@/components/ui/Icons';

export const metadata = {
  title: 'Cocina KDS | Ricuras FegaF',
};

export default function CocinaPage() {
  return (
    <main style={{ padding: '16px 24px', minHeight: '100vh', backgroundColor: 'var(--color-background)' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IconChefHat size={26} color="var(--color-primary)" /> Tablero de Cocina
        </h1>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Sistema en vivo (Realtime)
        </div>
      </header>
      
      <OrderBoard />
    </main>
  );
}
