import React, { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, ShoppingBag, Pencil, AlertTriangle } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMenuItems } from '@/lib/api';
import PizzaWizard from './PizzaWizard';

export default function CartDrawer({ storeOpen = true }) {
  const { items, updateQuantity, removeItem, updateItem, total, itemCount, isOpen, setIsOpen } = useCart();
  const [editingItem, setEditingItem] = useState(null);

  // Se recarga el menú para saber qué se ha agotado MIENTRAS el cliente
  // tenía el producto en el carrito.
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: fetchMenuItems,
    refetchOnWindowFocus: true,
  });

  // Mapa "categoria__nombre" -> disponible (true si algún tamaño lo está)
  const availabilityMap = useMemo(() => {
    const map = new Map();
    menuItems.forEach(row => {
      const key = `${row.category}__${row.name}`;
      const isOn = row.available !== false;
      map.set(key, (map.get(key) || false) || isOn);
    });
    return map;
  }, [menuItems]);

  const isItemSoldOut = (item) => {
    const base = item._originalItem || item;
    if (!base?.name || !base?.category) return false;
    const key = `${base.category}__${base.name}`;
    if (!availabilityMap.has(key)) return false; // no se sabe: no bloquear
    return availabilityMap.get(key) === false;
  };

  const soldOutItems = items.filter(isItemSoldOut);
  const hasSoldOut = soldOutItems.length > 0;

  const removeAllSoldOut = () => {
    soldOutItems.forEach(i => removeItem(i.id));
  };

  const handleEditSave = ({ size, division, flavors, toppings, removals, basePrice, finalPrice }) => {
    const primaryFlavor = flavors?.[0];
    const primaryItem   = primaryFlavor?.item || editingItem._originalItem || editingItem;
    const sizeLabel     = size ? ` (${size})` : '';

    const displayName = (!flavors || flavors.length <= 1)
      ? primaryItem.name + sizeLabel
      : flavors.map(f => f.item.name.replace(/^Pizza /i, '')).join(' + ') + sizeLabel;

    updateItem(editingItem.id, {
      ...editingItem,
      name: displayName,
      price: finalPrice ?? basePrice,
      _size:     size,
      _division: division,
      _flavors:  (flavors || []).map((f, i) => ({
        id:       f.item.id,
        name:     f.item.name,
        price:    size === '24cm' ? (f.item.price_23cm ?? f.item.price) : f.item.price,
        toppings: toppings?.[i] || [],
        removed:  removals?.[i] || [],
        _itemObj: f.item,
      })),
      _toppings:     toppings || [],
      _originalItem: primaryItem,
    });
    setEditingItem(null);
  };

  const getOriginalItem = (item) => item._originalItem || item;
  const getInitialValues = (item) => ({
    size:     item._size || null,
    division: item._division || null,
    flavors:  item._flavors || null,
    toppings: item._toppings || [],
    removals: item._flavors ? item._flavors.map(f => f.removed || []) : [],
  });

  return (
    <>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">
              Tu pedido ({itemCount} {itemCount === 1 ? 'producto' : 'productos'})
            </SheetTitle>
          </SheetHeader>

          {items.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-16 h-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">Tu carrito está vacío</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Añade productos para empezar</p>
            </div>
          ) : (
            <>
              {/* Aviso: hay productos que se han agotado */}
              {hasSoldOut && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-3">
                  <p className="text-amber-800 font-semibold text-sm flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    {soldOutItems.length === 1
                      ? 'Un producto se ha agotado'
                      : `${soldOutItems.length} productos se han agotado`}
                  </p>
                  <p className="text-amber-700 text-xs mt-1">
                    Quítalos del carrito para poder tramitar el pedido.
                  </p>
                  <button
                    onClick={removeAllSoldOut}
                    className="mt-2 w-full text-xs font-semibold bg-slate-600 hover:bg-slate-700 text-white rounded-lg py-2 transition-colors"
                  >
                    Quitar productos agotados
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto space-y-4 py-4">
                {items.map(item => {
                  const out = isItemSoldOut(item);
                  return (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 rounded-xl p-3 ${
                        out ? 'bg-slate-50 border border-slate-200' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className={`font-medium text-sm ${out ? 'text-slate-500 line-through' : ''}`}>
                            {item.name}
                          </p>
                          {out && (
                            <span className="bg-slate-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                              Agotada
                            </span>
                          )}
                        </div>

                        {/* Per-flavor removals (multi-flavor) or single-flavor */}
                        {item._flavors?.some(f => f.removed?.length > 0)
                          ? item._flavors.map((f, fi) => f.removed?.length > 0 && (
                            <p key={fi} className="text-xs text-slate-500 mt-0.5 leading-tight">
                              {item._flavors.length > 1
                                ? `${f.name.replace(/^Pizza /i, '')}: Sin ${f.removed.map(r => r.replace(/^Sin /i, '').toLowerCase()).join(', ')}`
                                : `Sin: ${f.removed.map(r => r.replace(/^Sin /i, '').toLowerCase()).join(', ')}`
                              }
                            </p>
                          ))
                          : item.removed_ingredients?.length > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5 leading-tight">
                              Sin: {item.removed_ingredients.map(r => r.replace(/^Sin /, '').toLowerCase()).join(', ')}
                            </p>
                          )
                        }

                        <p className={`font-semibold text-sm mt-0.5 ${out ? 'text-slate-400 line-through' : 'text-primary'}`}>
                          {(item.price * item.quantity).toFixed(2)} €
                        </p>

                        {!out && (item._originalItem || item.category === 'pizzas' || item.category === 'pizzas_dulces') && (
                          <button
                            onClick={() => setEditingItem(item)}
                            className="mt-1.5 flex items-center gap-1 text-xs text-primary/70 hover:text-primary transition-colors font-medium"
                          >
                            <Pencil className="w-3 h-3" />
                            Editar
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!out && (
                          <>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-semibold text-sm">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center hover:bg-muted transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => removeItem(item.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t pt-4 space-y-4 pb-safe" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
                <div className="flex justify-between items-center">
                  <span className="font-heading text-lg font-semibold">Total</span>
                  <span className="font-heading text-2xl font-bold text-primary">{total.toFixed(2)} €</span>
                </div>

                {!storeOpen ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                    <p className="text-amber-700 font-semibold text-sm">Restaurante cerrado</p>
                    <p className="text-amber-600 text-xs mt-0.5">No se aceptan pedidos ahora mismo</p>
                  </div>
                ) : hasSoldOut ? (
                  <Button
                    disabled
                    className="w-full rounded-xl py-6 text-lg bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted"
                  >
                    Quita los agotados para continuar
                  </Button>
                ) : (
                  <Link to="/checkout" onClick={() => setIsOpen(false)}>
                    <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-6 text-lg">
                      Tramitar pedido
                    </Button>
                  </Link>
                )}
                <Link to="/mis-pedidos" onClick={() => setIsOpen(false)} className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors pt-1">
                  Ver historial de pedidos
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {editingItem && (
        <PizzaWizard
          item={getOriginalItem(editingItem)}
          onClose={() => setEditingItem(null)}
          onConfirm={handleEditSave}
          initialValues={getInitialValues(editingItem)}
        />
      )}
    </>
  );
}
