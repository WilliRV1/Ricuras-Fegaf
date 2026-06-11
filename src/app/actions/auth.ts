'use server';

import { cookies } from 'next/headers';

export async function loginAction(formData: FormData) {
  const password = formData.get('password') as string;

  if (password === 'fgaf2026') {
    (await cookies()).set('auth_fgaf', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: '/',
    });
    return { success: true };
  }

  return { success: false, error: 'Contraseña incorrecta' };
}

export async function logoutAction() {
  (await cookies()).delete('auth_fgaf');
  return { success: true };
}
