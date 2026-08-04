// API client — usa Supabase directamente, sin pasar por Base44
import { supabase } from '@/lib/supabase.jsx';

export const fetchMenuItems = async () => {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    // ⚠️ Ya NO se filtra por available: queremos que los agotados se VEAN
    // en la carta marcados como "Agotada" (antes desaparecían del todo).
    // El filtrado real se hace en la UI (OrderMenu / MenuItemCard).
    .order('sort_order', { ascending: true })
    .limit(200);

  if (error) throw error;
  return data || [];
};
