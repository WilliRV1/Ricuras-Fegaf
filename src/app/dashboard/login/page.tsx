'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginDashboard } from '@/app/actions/dashboardAuth';
import { Button } from '@/components/ui/Button';

export default function DashboardLogin() {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('pin', pin);

    const result = await loginDashboard(formData);

    if (result.success) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setError(result.error || 'Error desconocido');
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '1rem'
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        padding: '2.5rem',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center',
        border: '1px solid var(--color-border)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>
          Acceso Restringido
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          Por favor, ingresa el PIN de administrador para ver el Dashboard.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: 'var(--color-danger)',
              padding: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <input
            type="password"
            placeholder="Ingresa el PIN numérico"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            disabled={loading}
            pattern="[0-9]*"
            inputMode="numeric"
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              border: '2px solid var(--color-border)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-text)',
              fontSize: '1.25rem',
              width: '100%',
              outline: 'none',
              textAlign: 'center',
              letterSpacing: '0.25em',
              fontWeight: 700
            }}
          />

          <Button 
            type="submit" 
            variant="primary" 
            disabled={!pin || loading}
            style={{ padding: '1rem', marginTop: '0.5rem', fontSize: '1.1rem' }}
          >
            {loading ? 'Verificando...' : 'Desbloquear Dashboard'}
          </Button>
        </form>
      </div>
    </div>
  );
}
