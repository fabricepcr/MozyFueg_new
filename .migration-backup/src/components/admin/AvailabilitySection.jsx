import React, { useState } from 'react';
import { db } from '@/lib/db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Eye, Loader2 } from 'lucide-react';

const CAT_LABELS = {
  pizzas: '🍕 Pizzas',
  pizzas_dulces: '🍫 Pizzas dulces',
  bebidas: '🥤 Bebidas',
  cocteles: '🍹 Cócteles',
};

const CAT_ORDER = ['pizzas', 'pizzas_dulces', 'bebidas', 'cocteles'];

export default function AvailabilitySection() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-menu'],
    queryFn: () => db.select('menu_items', {}),
  });

  const toggleAvailable = async (item) => {
    setTogglingId(item.id);
    try {
      await db.update('menu_items', item.id, { available: item.available === false });
      queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
    } finally {
      setTogglingId(null);
    }
  };

  const sorted = [...items].sort((a, b) => {
    const catDiff = (CAT_ORDER.indexOf(a.category) ?? 99) - (CAT_ORDER.indexOf(b.category) ?? 99);
    if (catDiff !== 0) return catDiff;
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  const grouped = CAT_ORDER
    .map(cat => ({ value: cat, label: CAT_LABELS[cat], items: sorted.filter(i => i.category === cat) }))
    .filter(g => g.items.length > 0);

  const activeCount = items.filter(i => i.available !== false).length;
  const totalCount = items.length;

  return (
    <div className="bg-card rounded-2xl border border-border/50 overflow-hidden mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Eye className="w-5 h-5 text-primary" />
          </div>
          <div className="text-left">
            <p className="font-heading font-semibold text-base">Disponibilidad de productos</p>
            <p className="text-xs text-muted-foreground">{activeCount} de {totalCount} activos</p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border/50 p-4 space-y-4">
          <p className="text-xs text-muted-foreground">
            Desactiva cualquier producto para que no aparezca en la carta. Los cambios se aplican al instante.
          </p>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="bg-muted rounded-xl h-12 animate-pulse" />)}</div>
          ) : (
            grouped.map(group => (
              <div key={group.value}>
                <h4 className="font-heading font-semibold text-xs text-muted-foreground mb-2">{group.label}</h4>
                <div className="space-y-2">
                  {group.items.map(item => {
                    const available = item.available !== false;
                    return (
                      <div key={item.id} className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${available ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          {item.image_url && (
                            <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{item.name}</p>
                            <p className={`text-xs ${available ? 'text-green-600' : 'text-red-600'}`}>
                              {available ? 'Disponible' : 'No disponible'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => toggleAvailable(item)}
                          disabled={togglingId === item.id}
                          className={`relative inline-flex items-center w-12 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${available ? 'bg-green-500' : 'bg-red-400'} ${togglingId === item.id ? 'opacity-50' : ''}`}
                        >
                          {togglingId === item.id ? (
                            <Loader2 className="w-4 h-4 absolute left-1/2 -translate-x-1/2 text-white animate-spin" />
                          ) : (
                            <span className={`inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${available ? 'translate-x-6' : 'translate-x-1'}`} />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}