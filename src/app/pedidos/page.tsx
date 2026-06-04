import { createClient } from '@/lib/supabase/server';
import { OrderContainer } from '@/components/pedidos/OrderContainer';
import styles from './page.module.css';

export const revalidate = 0; // Para asegurar que traiga datos frescos (Server Side Rendering)

export default async function PedidosPage() {
  const supabase = createClient();

  // Traer categorías
  const { data: categorias, error: catError } = await (await supabase)
    .from('categorias')
    .select('*')
    .order('orden', { ascending: true });

  if (catError) {
    console.error('Error obteniendo categorias:', catError);
  }

  // Traer productos (solo activos)
  const { data: productos, error: prodError } = await (await supabase)
    .from('productos')
    .select('*')
    .eq('activo', true);

  if (prodError) {
    console.error('Error obteniendo productos:', prodError);
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>Toma de Pedidos</h1>
        <p className={styles.subtitle}>Selecciona el tipo de atención y los productos.</p>
      </header>

      <div className={styles.content}>
        <div className={styles.mainColumn}>
          {/* Orquestador interactivo del cliente */}
          <OrderContainer 
            initialCategorias={categorias || []} 
            initialProductos={productos || []} 
          />
        </div>
        
        <div className={styles.cartColumn}>
          {/* Aquí irá el Carrito en el Día 3 */}
          <div className={styles.emptyCartPlaceholder}>
            <h3>Carrito de Compras</h3>
            <p>El carrito se implementará en el Día 3.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
