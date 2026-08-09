import React, { useState, useMemo } from 'react';
import { X, Check, Minus, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { fetchMenuItems } from '@/lib/api';
import { getRemovableIngredients, getSweetPizzaIngredients } from '@/lib/pizzaIngredients';

// ── Extras catalogue (name, price-24cm, price-33cm) ─────────────────────────
const ALL_EXTRAS = [
  ['Aceite de albahaca', 1.0, 2.0], ['Aceite de trufa', 2.0, 2.5],
  ['Aceitunas negras', 1.0, 1.5], ['Aceitunas verdes', 1.0, 1.5],
  ['Alcaparras', 1.0, 1.5], ['Alioli', 1.5, 2.0],
  ['Anchoas', 3.0, 3.5], ['Atún', 2.0, 2.5],
  ['Bacon', 2.0, 2.5], ['Banana', 1.0, 1.5],
  ['Brócoli', 1.0, 1.5], ['Butifarra del pagés', 3.0, 3.5],
  ['Calabresa', 4.0, 4.5], ['Catupiry', 3.0, 3.5],
  ['Cebolla caramelizada', 2.0, 2.5], ['Cebolla frita', 1.5, 2.0],
  ['Cebolla morada', 1.0, 1.5], ['Champiñones', 2.0, 2.5],
  ['Cheddar', 2.0, 2.5], ['Chorizo ibérico', 3.5, 4.0],
  ['Doritos', 3.0, 3.5], ['Fresas', 2.0, 2.5],
  ['Gorgonzola', 2.0, 2.5], ['Grana padano', 2.0, 2.5],
  ['Guisantes', 1.0, 1.5], ['Huevo cocido', 2.0, 2.5],
  ['Jamón dulce', 2.0, 2.5], ['Maíz dulce', 1.0, 1.5],
  ["M&M's", 2.5, 3.0], ['Mozzarella extra', 2.0, 2.5],
  ['Pepperoni', 2.0, 2.5], ['Perlas de mozzarella', 3.0, 3.5],
  ['Piña', 1.0, 1.5], ['Pimiento verde', 1.0, 1.5],
  ['Pollo', 4.0, 4.5], ['Provolone', 2.0, 2.5],
  ['Rúcula', 1.0, 1.5], ['Ruffles', 3.0, 3.5],
  ['Salsa barbacoa', 1.5, 2.0], ['Ternera', 4.0, 4.5],
  ['Tomate cherry', 1.0, 1.5], ['Tomate seco', 2.0, 2.5],
  ['Uvas', 1.5, 2.0],
];

const MAX_EXTRAS = 3;

/** Price of a pizza for the chosen size */
function flavorPrice(pizza, size) {
  return size === '24cm' ? (pizza.price_23cm ?? pizza.price) : pizza.price;
}

/** Build a deduped list of same-category pizzas from raw API rows */
function buildPizzaOptions(allItems, category) {
  const seen = new Map();
  allItems
    .filter(i => i.category === category && i.available !== false)
    .forEach(i => {
      if (!seen.has(i.name)) {
        seen.set(i.name, { ...i });
      } else {
        const ex = seen.get(i.name);
        const prices = [ex.price, i.price].sort((a, b) => a - b);
        ex.price_23cm = prices[0];
        ex.price = prices[1];
      }
    });
  return Array.from(seen.values());
}

// ── Sub-component: per-flavor ingredient removal pills ───────────────────────
function FlavorCard({ flavor, idx, totalFlavors, selectedSize, onRemoveFlavor, onToggleIngredient }) {
  const isDulce = flavor.item.category === 'pizzas_dulces';
  const removable = isDulce
    ? (getSweetPizzaIngredients(flavor.item.name)?.removable || [])
    : getRemovableIngredients(flavor.item.name);

  return (
    <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm text-foreground truncate">{flavor.item.name}</p>
          <p className="text-xs text-primary font-semibold mt-0.5">
            {flavorPrice(flavor.item, selectedSize).toFixed(2)} €
          </p>
        </div>
        {totalFlavors > 1 && (
          <button
            onClick={() => onRemoveFlavor(idx)}
            className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {removable.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-muted-foreground mb-1.5">Quitar ingredientes:</p>
          <div className="flex flex-wrap gap-1.5">
            {removable.map(ing => {
              const isRemoved = flavor.removed.includes(ing);
              return (
                <button
                  key={ing}
                  onClick={() => onToggleIngredient(idx, ing)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                    isRemoved
                      ? 'border-slate-400 bg-slate-50 text-slate-600 line-through'
                      : 'border-border/60 bg-card text-foreground/70 hover:border-slate-300 hover:text-slate-700'
                  }`}
                >
                  {isRemoved && <Minus className="w-2.5 h-2.5 inline mr-0.5" />}
                  {ing.replace(/^Sin /i, '')}
                </button>
              );
            })}
          </div>
          {flavor.removed.length > 0 && (
            <p className="text-xs text-amber-600 mt-1.5">
              Sin: {flavor.removed.map(r => r.replace(/^Sin /i, '')).join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function PizzaCustomizerModal({ item, onClose, onConfirm, initialValues, editMode }) {
  const hasSize = !!item.price_23cm;
  const isDulce = item.category === 'pizzas_dulces';

  // ── Initial state ──────────────────────────────────────────────────────────
  const initSize = initialValues?.size || (hasSize ? null : '33cm');

  const initFlavors = useMemo(() => {
    if (initialValues?.flavors?.length) {
      return initialValues.flavors.map(f => ({
        item: f._itemObj || item,
        removed: f.removed || [],
      }));
    }
    return [{ item, removed: initialValues?.removedIngredients || [] }];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [step, setStep] = useState(editMode ? 'flavors' : (hasSize ? 'size' : 'flavors'));
  const [selectedSize, setSelectedSize] = useState(initSize);
  const [flavors, setFlavors] = useState(initFlavors);
  const [extras, setExtras] = useState(initialValues?.extras || []);
  const [search, setSearch] = useState('');
  const [flavorSearch, setFlavorSearch] = useState('');

  // ── Constraints (B1) ──────────────────────────────────────────────────────
  const maxFlavors = selectedSize === '24cm' ? 2 : 4;
  const atFlavorLimit = flavors.length >= maxFlavors;

  // ── Fetch menu items for flavor picker (served from React-Query cache) ─────
  const { data: allItems = [] } = useQuery({
    queryKey: ['menuItems'],
    queryFn: fetchMenuItems,
    staleTime: 60000,
  });

  const pizzaOptions = useMemo(
    () => buildPizzaOptions(allItems.length ? allItems : [item], item.category),
    [allItems, item.category] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const filteredPizzaOptions = useMemo(() => {
    const q = flavorSearch.trim().toLowerCase();
    return q ? pizzaOptions.filter(p => p.name.toLowerCase().includes(q)) : pizzaOptions;
  }, [pizzaOptions, flavorSearch]);

  // ── Price (B4: base = most expensive chosen flavor) ────────────────────────
  const priceIdx = selectedSize === '24cm' ? 0 : 1;
  const basePrice = flavors.length
    ? Math.max(...flavors.map(f => flavorPrice(f.item, selectedSize)))
    : flavorPrice(item, selectedSize);

  const extrasWithPrice = useMemo(() =>
    ALL_EXTRAS.map(([name, p23, p33]) => ({
      id: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name,
      price: priceIdx === 0 ? p23 : p33,
    })),
    [priceIdx]
  );
  const filteredExtras = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? extrasWithPrice.filter(e => e.name.toLowerCase().includes(q)) : extrasWithPrice;
  }, [extrasWithPrice, search]);

  const extrasTotal = extras.reduce((s, e) => s + e.price, 0);
  const finalPrice = basePrice + extrasTotal;

  const isExtraSelected = (id) => extras.some(e => e.id === id);
  const atExtrasLimit = extras.length >= MAX_EXTRAS;

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleExtra = (extra) => {
    if (isExtraSelected(extra.id)) {
      setExtras(prev => prev.filter(e => e.id !== extra.id));
    } else if (!atExtrasLimit) {
      setExtras(prev => [...prev, extra]);
    }
  };

  const toggleFlavorIngredient = (flavorIdx, ingredient) => {
    setFlavors(prev => prev.map((f, i) =>
      i !== flavorIdx ? f : {
        ...f,
        removed: f.removed.includes(ingredient)
          ? f.removed.filter(r => r !== ingredient)
          : [...f.removed, ingredient],
      }
    ));
  };

  const addFlavor = (pizza) => {
    if (atFlavorLimit || flavors.some(f => f.item.name === pizza.name)) return;
    setFlavors(prev => [...prev, { item: pizza, removed: [] }]);
  };

  const removeFlavor = (idx) => {
    if (flavors.length <= 1) return;
    setFlavors(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    onConfirm({ size: selectedSize, flavors, extras, basePrice, finalPrice });
  };

  const goToExtras = () => isDulce ? handleConfirm() : setStep('extras');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative bg-background w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: 'calc(90vh - env(safe-area-inset-bottom))' }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* back button */}
            {(step === 'extras' || (step === 'flavors' && hasSize)) && (
              <button
                onClick={() => step === 'extras' ? setStep('flavors') : setStep('size')}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h2 className="font-heading font-bold text-foreground leading-tight">
                {step === 'size' ? 'Elige el tamaño'
                  : step === 'flavors' ? 'Elige tus sabores'
                  : 'Añadir extras'}
              </h2>
              {step !== 'size' && selectedSize && (
                <p className="text-xs text-muted-foreground mt-0.5">Pizza {selectedSize}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ══ STEP: SIZE ══════════════════════════════════════════════════════ */}
        {step === 'size' && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">Elige el tamaño de tu pizza</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { setSelectedSize('24cm'); setStep('flavors'); }}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-border hover:border-primary/60 bg-card hover:bg-primary/5 transition-all group"
              >
                <span className="text-3xl font-heading font-bold text-primary">24</span>
                <span className="text-xs text-muted-foreground font-medium text-center">
                  centímetros<br />hasta 2 sabores
                </span>
                <span className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                  {item.price_23cm?.toFixed(2)} €
                </span>
              </button>
              <button
                onClick={() => { setSelectedSize('33cm'); setStep('flavors'); }}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-primary bg-primary/5 hover:bg-primary/10 transition-all"
              >
                <span className="text-3xl font-heading font-bold text-primary">33</span>
                <span className="text-xs text-primary/70 font-medium text-center">
                  centímetros<br />hasta 4 sabores
                </span>
                <span className="text-lg font-bold text-primary">{item.price?.toFixed(2)} €</span>
                <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-medium">Popular</span>
              </button>
            </div>
          </div>
        )}

        {/* ══ STEP: FLAVORS ═══════════════════════════════════════════════════ */}
        {step === 'flavors' && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

              {/* B5: sweet/savory warning + flavor counter */}
              <div className="flex items-center gap-2 text-xs bg-muted/50 rounded-xl px-3 py-2.5 border border-border/40">
                <span className="text-base">🍕</span>
                <div className="flex-1 min-w-0">
                  <span className="text-muted-foreground">
                    {isDulce ? 'Solo sabores dulces · ' : 'Solo sabores salados · '}
                  </span>
                  <span className="font-semibold text-foreground">
                    {flavors.length}/{maxFlavors} sabores elegidos
                  </span>
                  {!isDulce && (
                    <span className="text-muted-foreground"> · No mezclamos dulce y salado</span>
                  )}
                </div>
              </div>

              {/* Selected flavors (B1 + B2) */}
              <div className="space-y-2">
                {flavors.map((f, idx) => (
                  <FlavorCard
                    key={`${f.item.name}-${idx}`}
                    flavor={f}
                    idx={idx}
                    totalFlavors={flavors.length}
                    selectedSize={selectedSize}
                    onRemoveFlavor={removeFlavor}
                    onToggleIngredient={toggleFlavorIngredient}
                  />
                ))}
              </div>

              {/* Flavor picker */}
              {!atFlavorLimit ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                    + Añadir otro sabor
                  </p>
                  {pizzaOptions.length > 5 && (
                    <div className="relative mb-2.5">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        value={flavorSearch}
                        onChange={e => setFlavorSearch(e.target.value)}
                        placeholder="Buscar sabor..."
                        className="w-full text-sm bg-muted/40 border border-border/50 rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {filteredPizzaOptions.map(pizza => {
                      const already = flavors.some(f => f.item.name === pizza.name);
                      const price = flavorPrice(pizza, selectedSize);
                      return (
                        <button
                          key={pizza.name}
                          onClick={() => addFlavor(pizza)}
                          disabled={already}
                          className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 border text-sm transition-all text-left ${
                            already
                              ? 'border-primary/30 bg-primary/5 text-primary cursor-default'
                              : 'border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
                          }`}
                        >
                          <span className="font-medium truncate">{pizza.name}</span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-muted-foreground">{price.toFixed(2)} €</span>
                            {already
                              ? <Check className="w-4 h-4 text-primary" />
                              : <Plus className="w-4 h-4 text-primary/70" />
                            }
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-center text-muted-foreground py-2">
                  Máximo de {maxFlavors} sabores para pizza {selectedSize} ✓
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pt-4 border-t bg-background flex-shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span>
                  {flavors.length > 1
                    ? `Base: sabor más caro`
                    : `Precio base`}
                </span>
                <span className="font-bold text-primary text-sm">{basePrice.toFixed(2)} €</span>
              </div>
              <Button
                onClick={goToExtras}
                disabled={flavors.length === 0}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-semibold gap-2"
              >
                {isDulce ? (
                  <>
                    {editMode ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {editMode ? `Guardar · ${finalPrice.toFixed(2)} €` : `Añadir · ${finalPrice.toFixed(2)} €`}
                  </>
                ) : (
                  <>
                    Extras
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ══ STEP: EXTRAS ════════════════════════════════════════════════════ */}
        {step === 'extras' && !isDulce && (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Añadir extras (opcional)
                </p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  atExtrasLimit ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                }`}>
                  {extras.length}/{MAX_EXTRAS} máx.
                </span>
              </div>

              {extras.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {extras.map(e => (
                    <button
                      key={e.id}
                      onClick={() => toggleExtra(e)}
                      className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/30 rounded-full px-3 py-1 font-medium hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300 transition-colors"
                    >
                      {e.name} +{e.price.toFixed(2)}€
                      <X className="w-3 h-3" />
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar extra..."
                  className="w-full text-sm bg-muted/40 border border-border/50 rounded-xl pl-9 pr-3 py-2 outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {filteredExtras.map(extra => {
                  const sel = isExtraSelected(extra.id);
                  const disabled = atExtrasLimit && !sel;
                  return (
                    <button
                      key={extra.id}
                      onClick={() => toggleExtra(extra)}
                      disabled={disabled}
                      className={`flex items-center justify-between gap-2 text-left rounded-xl px-3 py-2.5 border-2 text-sm transition-all ${
                        sel
                          ? 'border-primary bg-primary/8 text-primary'
                          : disabled
                            ? 'border-border/20 bg-muted/10 text-muted-foreground/40 cursor-not-allowed'
                            : 'border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <span className="truncate text-xs font-medium">{extra.name}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">+{extra.price.toFixed(2)}€</span>
                        {sel && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 pt-4 border-t bg-background flex-shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              {(extras.length > 0 || flavors.length > 1) && (
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>
                    Base {basePrice.toFixed(2)} €
                    {extras.length > 0 && ` + extras ${extrasTotal.toFixed(2)} €`}
                  </span>
                  <span className="font-bold text-primary text-sm">{finalPrice.toFixed(2)} €</span>
                </div>
              )}
              <Button
                onClick={handleConfirm}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-semibold gap-2"
              >
                {editMode ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editMode
                  ? `Guardar cambios · ${finalPrice.toFixed(2)} €`
                  : `Añadir · ${finalPrice.toFixed(2)} €`
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
