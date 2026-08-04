import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Search, X, ChevronDown, ChevronUp } from 'lucide-react';

// [name, price_24cm, price_33cm]
const ALL_EXTRAS = [
  ['Aceite de albahaca',   1.0, 2.0],
  ['Aceite de trufa',      2.0, 2.5],
  ['Aceitunas negras',     1.0, 1.5],
  ['Aceitunas verdes',     1.0, 1.5],
  ['Alcaparras',           1.0, 1.5],
  ['Alioli',               1.5, 2.0],
  ['Anchoas',              3.0, 3.5],
  ['Atún',                 2.0, 2.5],
  ['Bacon',                2.0, 2.5],
  ['Banana',               1.0, 1.5],
  ['Brócoli',              1.0, 1.5],
  ['Butifarra del pagés',  3.0, 3.5],
  ['Calabresa',            4.0, 4.5],
  ['Catupiry',             3.0, 3.5],
  ['Cebolla caramelizada', 2.0, 2.5],
  ['Cebolla frita',        1.5, 2.0],
  ['Cebolla morada',       1.0, 1.5],
  ['Champiñones',          2.0, 2.5],
  ['Cheddar',              2.0, 2.5],
  ['Chorizo ibérico',      3.5, 4.0],
  ['Doritos',              3.0, 3.5],
  ['Fresas',               2.0, 2.5],
  ['Gorgonzola',           2.0, 2.5],
  ['Grana padano',         2.0, 2.5],
  ['Guisantes',            1.0, 1.5],
  ['Huevo cocido',         2.0, 2.5],
  ['Jamón dulce',          2.0, 2.5],
  ['Maíz dulce',           1.0, 1.5],
  ["M&M's",                2.5, 3.0],
  ['Mozzarella extra',     2.0, 2.5],
  ['Pepperoni',            2.0, 2.5],
  ['Perlas de mozzarella', 3.0, 3.5],
  ['Piña',                 1.0, 1.5],
  ['Pimiento verde',       1.0, 1.5],
  ['Pollo',                4.0, 4.5],
  ['Provolone',            2.0, 2.5],
  ['Rúcula',               1.0, 1.5],
  ['Ruffles',              3.0, 3.5],
  ['Salsa barbacoa',       1.5, 2.0],
  ['Ternera',              4.0, 4.5],
  ['Tomate cherry',        1.0, 1.5],
  ['Tomate seco',          2.0, 2.5],
  ['Uvas',                 1.5, 2.0],
];

const MAX_EXTRAS = 3;

export default function ExtrasSelector({ selectedSize, basePrice, onConfirm, onBack }) {
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Determine price column: '23cm' → index 1, '33cm' → index 2
  const priceIdx = selectedSize === '23cm' ? 1 : 2;

  const extras = useMemo(() => {
    return ALL_EXTRAS.map(([name, p24, p33]) => ({
      id: name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      name,
      price: priceIdx === 1 ? p24 : p33,
    }));
  }, [priceIdx]);

  const filtered = useMemo(() => {
    if (!search.trim()) return extras;
    const q = search.toLowerCase();
    return extras.filter(e => e.name.toLowerCase().includes(q));
  }, [extras, search]);

  const displayed = showAll || search.trim() ? filtered : filtered.slice(0, 12);

  const isSelected = (id) => selected.some(e => e.id === id);
  const atLimit = selected.length >= MAX_EXTRAS;

  const toggle = (extra) => {
    if (isSelected(extra.id)) {
      setSelected(prev => prev.filter(e => e.id !== extra.id));
    } else if (!atLimit) {
      setSelected(prev => [...prev, extra]);
    }
  };

  const extrasTotal = selected.reduce((s, e) => s + e.price, 0);
  const finalPrice = (basePrice ?? 0) + extrasTotal;

  return (
    <div className="mt-2 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Extras · {selectedSize || '33cm'}
        </p>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-all ${
          atLimit
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted text-muted-foreground'
        }`}>
          {selected.length}/{MAX_EXTRAS}
        </span>
      </div>

      {/* Limit warning */}
      {atLimit && (
        <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-1.5">
          Máximo {MAX_EXTRAS} extras por pizza
        </p>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar ingrediente..."
          className="w-full text-sm bg-muted/40 border border-border/50 rounded-lg pl-8 pr-8 py-1.5 outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50 placeholder:text-muted-foreground/60"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(e => (
            <button
              key={e.id}
              onClick={() => toggle(e)}
              className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1 font-medium hover:bg-primary/20 transition-colors"
            >
              {e.name}
              <X className="w-3 h-3" />
            </button>
          ))}
        </div>
      )}

      {/* Grid of extras */}
      <div className="max-h-48 overflow-y-auto pr-0.5 space-y-1">
        {displayed.map(extra => {
          const sel = isSelected(extra.id);
          const disabled = atLimit && !sel;
          return (
            <button
              key={extra.id}
              onClick={() => toggle(extra)}
              disabled={disabled}
              className={`flex items-center justify-between w-full text-left rounded-lg px-3 py-2 text-sm border transition-all ${
                sel
                  ? 'border-primary bg-primary/8 text-primary font-medium'
                  : disabled
                    ? 'border-border/30 bg-muted/20 text-muted-foreground/40 cursor-not-allowed'
                    : 'border-border/40 bg-muted/20 text-foreground hover:bg-muted/50 hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                  sel ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                }`}>
                  {sel && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="truncate">{extra.name}</span>
              </div>
              <span className={`text-xs ml-2 flex-shrink-0 font-medium ${sel ? 'text-primary' : 'text-muted-foreground'}`}>
                +{extra.price.toFixed(2)} €
              </span>
            </button>
          );
        })}
        {!search && filtered.length > 12 && (
          <button
            onClick={() => setShowAll(v => !v)}
            className="w-full text-xs text-primary/70 hover:text-primary flex items-center justify-center gap-1 py-1.5 border border-dashed border-primary/20 rounded-lg hover:bg-primary/5 transition-colors"
          >
            {showAll ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Ver menos</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Ver todos ({filtered.length})</>
            )}
          </button>
        )}
      </div>

      {/* Price summary */}
      {selected.length > 0 && (
        <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Base {(basePrice ?? 0).toFixed(2)} € + extras {extrasTotal.toFixed(2)} €
          </span>
          <span className="text-sm font-bold text-primary">{finalPrice.toFixed(2)} €</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onBack} className="flex-shrink-0 px-3">
          ←
        </Button>
        <Button
          size="sm"
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => onConfirm(selected)}
        >
          {selected.length > 0 ? `Añadir · ${finalPrice.toFixed(2)} €` : 'Añadir sin extras'}
        </Button>
      </div>
    </div>
  );
}