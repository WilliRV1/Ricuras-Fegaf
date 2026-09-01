import { listarUsuarios } from '@/app/actions/auth';
import { LoginFlow } from '@/components/login/LoginFlow';

// La lista de personas cambia cuando administración da de alta a alguien:
// no tiene sentido servirla en caché.
export const dynamic = 'force-dynamic';

/**
 * Pantalla de entrada (`/login`).
 *
 * Muestra a la gente activa del local como botones. La lista se arma en el
 * servidor y solo lleva nombre y rol: el PIN nunca sale de la base de datos.
 */
export default async function LoginPage() {
  const res = await listarUsuarios();

  return (
    <LoginFlow
      usuarios={res.success ? res.usuarios : []}
      errorCarga={res.success ? undefined : res.error}
    />
  );
}
