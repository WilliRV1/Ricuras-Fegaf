/**
 * Traduce los errores que lanzan las funciones de usuarios a algo que se
 * entienda en el local.
 *
 * Los mensajes de entrada no distinguen "esa persona no existe" de "el PIN
 * está mal" a propósito: decirlo sería regalar la mitad del trabajo a quien
 * esté probando.
 */
/**
 * La base rechazó la acción porque el rol de la sesión no alcanza. Llega si
 * alguien invoca la API por fuera de la app o si la sesión cambió de rol.
 */
export const MENSAJE_ROL_NO_AUTORIZADO =
  'Tu sesión no tiene permiso para esta acción. Cierra sesión y vuelve a entrar.';

export function mensajeDeErrorAuth(mensaje: string | undefined): string {
  if (!mensaje) return 'No se pudo completar la operación.';

  if (mensaje.includes('ROL_NO_AUTORIZADO')) return MENSAJE_ROL_NO_AUTORIZADO;

  if (mensaje.includes('USUARIO_BLOQUEADO')) {
    return 'Demasiados intentos fallidos. Espera 5 minutos e inténtalo de nuevo.';
  }
  if (mensaje.includes('CREDENCIALES_INVALIDAS')) return 'PIN incorrecto.';
  if (mensaje.includes('PIN_INVALIDO')) {
    return 'El PIN debe ser de 4 dígitos y no puede ser algo obvio como 1111 o 1234.';
  }
  if (mensaje.includes('PIN_REPETIDO')) return 'El PIN nuevo tiene que ser distinto al actual.';
  if (mensaje.includes('ADMIN_NO_AUTORIZADO')) {
    return 'Esa acción es solo de administración y el PIN no coincide.';
  }
  if (mensaje.includes('NOMBRE_REPETIDO')) return 'Ya hay alguien registrado con ese nombre.';
  if (mensaje.includes('NOMBRE_REQUERIDO')) return 'Escribe el nombre de la persona.';
  if (mensaje.includes('ROL_INVALIDO')) return 'El rol elegido no es válido.';
  if (mensaje.includes('ULTIMO_ADMIN')) {
    return 'No puedes desactivar al último administrador: alguien tiene que poder administrar.';
  }
  if (mensaje.includes('USUARIO_NO_ENCONTRADO')) return 'Esa persona ya no existe.';

  return 'No se pudo completar la operación.';
}
