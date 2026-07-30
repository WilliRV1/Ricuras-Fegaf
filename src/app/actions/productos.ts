'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function toggleProductStatus(productoId: number, isActive: boolean) {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase
      .from('productos')
      .update({ activo: isActive })
      .eq('id', productoId);

    if (error) {
      console.error('Error toggling product status:', error);
      return { success: false, error: 'No se pudo actualizar el estado del producto.' };
    }

    // Revalidate the paths where products are shown so they update
    revalidatePath('/pedidos');
    revalidatePath('/dashboard');
    
    return { success: true };
  } catch (error) {
    console.error('Unexpected error toggling product:', error);
    return { success: false, error: 'Error inesperado del servidor.' };
  }
}
