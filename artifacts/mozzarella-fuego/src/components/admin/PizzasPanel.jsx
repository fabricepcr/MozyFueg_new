import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pizza, Save, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const TABLE = 'menu_items';

export default function PizzasPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [draft, setDraft] = useState({});        // { [id]: boolean } — overall availability
  const [draftSizes, setDraftSizes] = useState({}); // { [id]: { cm33: bool, cm24: bool } }
  const [saving, setSaving] = useState(false);
  const [expandedIngredients, setExpandedIngredients] = useState({}); // { [id]: boolean }
  const [draftIngredients, setDraftIngredients] = useState({});       // { [id]: string }
  const [savingIngredients, setSavingIngredients] = useState({});     // { [id]: boolean }

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ['admin-menu-items'],
    queryFn: async () => {
      const data = await db.select(TABLE, {});
      return data || [];
    },
    staleTime: 0,
  });

  // Cargar el estado real de la BD en el borrador local.
  useEffect(() => {
    if (!items.length) return;
    const initial = {};
    const initialSizes = {};
    const initialIngredients = {};
    items.forEach(p => {
      initial[p.id] = p.available !== false;
      initialSizes[p.id] = {
        cm33: p.available_33cm !== false,
        cm24: p.available_24cm !== false,
      };
      // Only set if not already being edited
      initialIngredients[p.id] = p.ingredients ?? '';
    });
    setDraft(initial);
    setDraftSizes(initialSizes);
    setDraftIngredients(prev => {
      // Preserve any in-progress edits
      const merged = { ...initialIngredients };
      Object.keys(prev).forEach(id => { if (prev[id] !== undefined) merged[id] = prev[id]; });
      return merged;
    });
  }, [items]);

  const toggleIngredientsExpand = (id) =>
    setExpandedIngredients(prev => ({ ...prev, [id]: !prev[id] }));

  const handleSaveIngredients = async (item) => {
    setSavingIngredients(prev => ({ ...prev, [item.id]: true }));
    try {
      await db.update(TABLE, item.id, { ingredients: draftIngredients[item.id] ?? '' });
      await queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      await queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast({
        title: '✅ Ingredientes actualizados',
        description: `${item.name} — ingredientes guardados.`,
        duration: 3000,
      });
      setExpandedIngredients(prev => ({ ...prev, [item.id]: false }));
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive', duration: 5000 });
    } finally {
      setSavingIngredients(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const toggle = (id) => setDraft(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleSize = (id, key) =>
    setDraftSizes(prev => ({ ...prev, [id]: { ...prev[id], [key]: !prev[id]?.[key] } }));

  const setAll = (value) => {
    const next = {};
    items.forEach(p => { next[p.id] = value; });
    setDraft(next);
  };

  // Cambios pendientes = los que difieren de lo guardado en la BD.
  const changed = items.filter(p => {
    const sizes = draftSizes[p.id] ?? { cm33: true, cm24: true };
    return (p.available !== false) !== draft[p.id]
      || (p.available_33cm !== false) !== sizes.cm33
      || (p.available_24cm !== false) !== sizes.cm24;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const p of changed) {
        const sizes = draftSizes[p.id] ?? { cm33: true, cm24: true };
        await db.update(TABLE, p.id, {
          available: draft[p.id],
          available_33cm: sizes.cm33,
          available_24cm: sizes.cm24,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      await queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast({
        title: '✅ Disponibilidad actualizada',
        description: `${changed.length} producto${changed.length === 1 ? '' : 's'} actualizado${changed.length === 1 ? '' : 's'}. Ya se ve en la tienda.`,
        duration: 3000,
      });
    } catch (err) {
      toast({
        title: 'Error al guardar',
        description: err.message,
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        ⚠️ No se pudieron cargar los productos. Comprueba que la tabla <strong>menu_items</strong> tiene
        la columna <strong>available</strong> (ejecuta el SQL en Supabase).
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="bg-muted/40 rounded-2xl p-8 text-center text-muted-foreground">
        No hay productos en el menú.
      </div>
    );
  }

  const availableCount = items.filter(p => draft[p.id]).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Desactiva los productos que se hayan <strong>agotado</strong>. Los clientes los verán
        como “Agotado” y no podrán pedirlos.
      </p>

      <div className="flex items-center justify-between bg-muted/40 rounded-xl px-4 py-3 gap-3 flex-wrap">
        <span className="text-sm font-semibold">
          {availableCount} de {items.length} disponibles
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setAll(true)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
          >
            Activar todos
          </button>
          <button
            onClick={() => setAll(false)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
          >
            Desactivar todos
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {items.map(item => {
          const isOn = !!draft[item.id];
          const img = item.image_url || item.image || item.imagen;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border-2 p-4 transition-all ${
                isOn ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {img ? (
                    <img
                      src={img}
                      alt={item.name}
                      className={`w-12 h-12 rounded-xl object-cover flex-shrink-0 transition-all ${
                        isOn ? '' : 'grayscale opacity-60'
                      }`}
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-green-100' : 'bg-red-100'}`}>
                      <Pizza className={`w-5 h-5 ${isOn ? 'text-green-700' : 'text-red-700'}`} />
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className={`font-semibold text-base truncate ${isOn ? 'text-green-800' : 'text-red-800'}`}>
                      {item.name}
                    </p>
                    <p className={`text-xs mt-0.5 flex items-center gap-1 flex-wrap ${isOn ? 'text-green-600' : 'text-red-600'}`}>
                      {isOn
                        ? <><CheckCircle2 className="w-3 h-3" /> Disponible</>
                        : <><XCircle className="w-3 h-3" /> Agotado — no se puede pedir</>
                      }
                      {item.price != null && (
                        <span className="text-muted-foreground ml-1">· {Number(item.price).toFixed(2)} €</span>
                      )}
                    </p>
                    {/* Per-size toggles — only meaningful when item is available */}
                    {isOn && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {[
                          { key: 'cm33', label: '33 cm' },
                          { key: 'cm24', label: '24 cm' },
                        ].map(({ key, label }) => {
                          const sizeOn = draftSizes[item.id]?.[key] !== false;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => toggleSize(item.id, key)}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                                sizeOn
                                  ? 'bg-green-100 border-green-300 text-green-700'
                                  : 'bg-red-100 border-red-300 text-red-600 line-through'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className={`relative inline-flex items-center w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none flex-shrink-0 ${isOn ? 'bg-green-500' : 'bg-red-400'}`}
                >
                  <span className={`inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isOn ? 'translate-x-8' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Ingredients editor (pizzas only) */}
              {item.category?.toLowerCase().includes('pizza') && (
                <div className="mt-3 border-t border-border/30 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleIngredientsExpand(item.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expandedIngredients[item.id]
                      ? <ChevronUp className="w-3.5 h-3.5" />
                      : <ChevronDown className="w-3.5 h-3.5" />}
                    Editar ingredientes
                    {draftIngredients[item.id] && (
                      <span className="ml-1 text-muted-foreground/60 font-normal truncate max-w-[180px]">
                        · {draftIngredients[item.id]}
                      </span>
                    )}
                  </button>

                  {expandedIngredients[item.id] && (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={draftIngredients[item.id] ?? ''}
                        onChange={e => setDraftIngredients(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="mozzarella, tomate, orégano, aceitunas…"
                        className="w-full text-xs rounded-lg border border-border/60 bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                      {/* Live chip preview */}
                      {draftIngredients[item.id] && (
                        <div className="flex flex-wrap gap-1">
                          {draftIngredients[item.id]
                            .split(/,\s*|\s+y\s+/)
                            .map(s => s.trim())
                            .filter(Boolean)
                            .map((ing, idx) => (
                              <span key={idx} className="text-[11px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5">
                                {ing}
                              </span>
                            ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSaveIngredients(item)}
                        disabled={savingIngredients[item.id]}
                        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        {savingIngredients[item.id]
                          ? <><Loader2 className="w-3 h-3 animate-spin" />Guardando…</>
                          : <><Save className="w-3 h-3" />Guardar ingredientes</>}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {changed.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
          Tienes {changed.length} cambio{changed.length === 1 ? '' : 's'} sin guardar.
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saving || changed.length === 0}
        className="w-full mt-2 gap-2 rounded-xl py-5 text-base"
      >
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</>
          : <><Save className="w-4 h-4" />Guardar disponibilidad</>
        }
      </Button>
    </div>
  );
}
