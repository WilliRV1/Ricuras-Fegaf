'use client';

import { useRouter } from 'next/navigation';

interface DatePickerProps {
  currentDate: string; // 'YYYY-MM-DD'
}

export const DatePicker: React.FC<DatePickerProps> = ({ currentDate }) => {
  const router = useRouter();
  const todayISO = new Date().toISOString().split('T')[0];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.value;
    if (selected && selected <= todayISO) {
      router.push(`/dashboard?date=${selected}`);
    }
  };

  return (
    <input
      type="date"
      value={currentDate}
      max={todayISO}
      onChange={handleChange}
      style={{
        padding: '8px 12px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-surface)',
        color: 'var(--color-text)',
        fontSize: '0.9rem',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      aria-label="Seleccionar fecha del dashboard"
      id="dashboard-date-picker"
    />
  );
};
