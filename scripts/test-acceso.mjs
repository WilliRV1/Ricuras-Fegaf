/**
 * Prueba del control de acceso contra la app corriendo.
 *
 *   npm run dev          (en otra terminal)
 *   node scripts/test-acceso.mjs [http://localhost:3000]
 *
 * Comprueba lo que no se puede comprobar desde la base: que una cookie
 * inventada a mano no sirva, que una vencida no sirva, y que cada rol solo
 * llegue a sus pantallas.
 *
 * No crea ni modifica nada: solo pide páginas.
 */

const BASE = process.argv[2] ?? 'http://localhost:3000';
const COOKIE = 'sesion_fgaf';

// La misma clave por defecto que usa la app cuando falta SESSION_SECRET.
// En producción SESSION_SECRET está definida y estas cookies no valdrían.
const SECRETO = process.env.SESSION_SECRET || 'ricuras-fegaf-clave-por-defecto-cambiar';

let fallos = 0;
let pruebas = 0;

function check(nombre, condicion, detalle = '') {
  pruebas++;
  if (condicion) {
    console.log(`  ok    ${nombre}`);
  } else {
    fallos++;
    console.log(`  FALLA ${nombre} ${detalle}`);
  }
}

function aBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function firmar(datos) {
  const clave = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRETO),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const firma = await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(datos));
  return aBase64Url(new Uint8Array(firma));
}

/** Arma una cookie de sesión válida, como haría la app al entrar */
async function cookieDe(rol, { vencida = false, firmaMala = false } = {}) {
  const sesion = {
    id: 1,
    nombre: 'Prueba',
    rol,
    exp: Math.floor(Date.now() / 1000) + (vencida ? -60 : 3600),
  };
  const cuerpo = aBase64Url(new TextEncoder().encode(JSON.stringify(sesion)));
  const firma = firmaMala ? 'firmainventada' : await firmar(cuerpo);
  return `${COOKIE}=${cuerpo}.${firma}`;
}

/** Pide una ruta y devuelve el estado y a dónde redirige */
async function pedir(ruta, cookie) {
  const res = await fetch(`${BASE}${ruta}`, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
  });
  const destino = res.headers.get('location');
  return {
    estado: res.status,
    // La redirección puede venir absoluta o relativa
    destino: destino ? new URL(destino, BASE).pathname : null,
  };
}

try {
  await fetch(BASE, { redirect: 'manual' });
} catch {
  console.error(`No hay nada escuchando en ${BASE}. Levanta la app con "npm run dev".`);
  process.exit(1);
}

console.log('\n[1] Sin sesión');
for (const ruta of ['/', '/pedidos', '/cocina', '/liquidacion', '/dashboard']) {
  const r = await pedir(ruta);
  check(`${ruta} manda a la pantalla de entrada`, r.destino === '/login', `(${r.estado} → ${r.destino})`);
}
const login = await pedir('/login');
check('/login sí se puede ver', login.estado === 200, `(${login.estado})`);

console.log('\n[2] Cookies falsas');
const inventada = await cookieDe('admin', { firmaMala: true });
const rInventada = await pedir('/dashboard', inventada);
check(
  'una cookie con firma inventada no entra al dashboard',
  rInventada.destino === '/login',
  `(${rInventada.estado} → ${rInventada.destino})`
);

const rBasura = await pedir('/dashboard', `${COOKIE}=cualquiercosa`);
check('una cookie con basura tampoco', rBasura.destino === '/login', `(${rBasura.destino})`);

const rVieja = await pedir('/dashboard', await cookieDe('admin', { vencida: true }));
check('una sesión vencida tampoco', rVieja.destino === '/login', `(${rVieja.destino})`);

console.log('\n[3] Cada rol en lo suyo');
const cocina = await cookieDe('cocina');
check('cocina entra a su tablero', (await pedir('/cocina', cocina)).estado === 200);
for (const ruta of ['/pedidos', '/liquidacion', '/dashboard', '/']) {
  const r = await pedir(ruta, cocina);
  check(`cocina no llega a ${ruta}`, r.destino === '/cocina', `(${r.estado} → ${r.destino})`);
}

const cajero = await cookieDe('cajero');
for (const ruta of ['/pedidos', '/liquidacion', '/cocina']) {
  check(`caja entra a ${ruta}`, (await pedir(ruta, cajero)).estado === 200);
}
const cajeroDash = await pedir('/dashboard', cajero);
check(
  'caja NO entra al dashboard',
  cajeroDash.destino === '/pedidos',
  `(${cajeroDash.estado} → ${cajeroDash.destino})`
);

const admin = await cookieDe('admin');
for (const ruta of ['/pedidos', '/liquidacion', '/cocina', '/dashboard']) {
  check(`administración entra a ${ruta}`, (await pedir(ruta, admin)).estado === 200);
}

console.log('\n[4] Con sesión abierta, el login sobra');
const loginConSesion = await pedir('/login', admin);
check(
  'a administración la manda al dashboard',
  loginConSesion.destino === '/dashboard',
  `(${loginConSesion.destino})`
);
const loginCocina = await pedir('/login', cocina);
check('a cocina la manda a su tablero', loginCocina.destino === '/cocina', `(${loginCocina.destino})`);

console.log(
  `\n${fallos === 0 ? '✅ TODO OK' : '❌ CON FALLAS'} — ${pruebas - fallos}/${pruebas} pruebas pasaron`
);
process.exitCode = fallos === 0 ? 0 : 1;
