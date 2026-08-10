'use server';

import { cookies } from 'next/headers';

export async function loginDashboard(formData: FormData) {
  const pin = formData.get('pin') as string;

  if (pin === '3136') {
    (await cookies()).set('dashboard_auth', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 días
      path: '/dashboard',
    });
    return { success: true };
  }

  return { success: false, error: 'PIN incorrecto' };
}

export async function logoutDashboard() {
  (await cookies()).delete('dashboard_auth');
  return { success: true };
}
