import { createClient } from '@/lib/supabase/server';
import { OrderContainer } from '@/components/pedidos/OrderContainer';
import { ToastContainer } from '@/components/ui/Toast';
import styles from './page.module.css';

export const revalidate = 0; // Para asegurar que traiga datos frescos (Server Side Rendering)

/**
 * Página de Toma de Pedidos (`/pedidos`).
 *
 * - Server Component que obtiene las categorías y productos de Supabase.
 * - Pasa los datos al `OrderContainer` (Client Component interactivo).
 * - Incluye el `ToastContainer` para notificaciones visuales al agregar productos.
 *
 * Layout de dos columnas:
 * - **Columna principal**: Selector de tipo + formulario + menú digital.
 * - **Columna lateral**: Carrito de compras (a implementar Día 3).
 *
 * Acepta dos parámetros de URL, ambos enviados desde liquidación:
 * - `?editar=<id>`: abre un pedido sin cobrar para agregarle algo.
 * - `?rehacer=<id>`: carga los productos de un pedido anulado para volver a
 *   montarlo sin digitarlo de nuevo.
 */
interface PedidosPageProps {
  searchParams: Promise<{ editar?: string; rehacer?: string }>;
}

/** Convierte un parámetro de URL en un id de pedido válido, o null */
function parsePedidoId(valor?: string) {
  if (!valor) return null;
  const id = Number.parseInt(valor, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export default async function PedidosPage({ searchParams }: PedidosPageProps) {
  const { editar, rehacer } = await searchParams;
  const supabase = createClient();

  // Traer categorías ordenadas
  const { data: categorias, error: catError } = await (await supabase)
    .from('categorias')
    .select('*')
    .order('orden', { ascending: true });

  if (catError) {
    console.error('Error obteniendo categorias:', catError);
  }

  // Traer productos (todos, para mostrar los agotados deshabilitados)
  const { data: productos, error: prodError } = await (await supabase)
    .from('productos')
    .select('*');

  if (prodError) {
    console.error('Error obteniendo productos:', prodError);
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Toma de Pedidos</h1>
        <p className={styles.subtitle}>Selecciona el tipo de atención, completa los datos y agrega productos al pedido.</p>
      </header>

      <div className={styles.content}>
        <OrderContainer
          initialCategorias={categorias || []}
          initialProductos={productos || []}
          editarId={parsePedidoId(editar)}
          rehacerId={parsePedidoId(rehacer)}
        />
      </div>

      {/* Sistema global de notificaciones toast */}
      <ToastContainer />
    </main>
  );
}
