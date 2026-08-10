import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Check, Plus, Search, X, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchMenuItems, fetchToppings } from '@/lib/api';

// ── Design tokens ─────────────────────────────────────────────────────────
const SLOT_COLORS = ['#16a34a', '#d97706', '#7c3aed', '#0891b2'];
const MAX_TOPPINGS_PER_SLOT = 3;

// ── Size catalogue ────────────────────────────────────────────────────────
const MF_SIZES = [
  { id: '24cm', label: 'Pequeña', cm: '24 cm', serves: 'Para 1–2 personas', maxFlavors: 2 },
  { id: '33cm', label: 'Grande',  cm: '33 cm', serves: 'Para 2–4 personas', maxFlavors: 4 },
];

// ── División options ──────────────────────────────────────────────────────
const DIVISIONS = [
  { id: 'entera', label: 'Entera',        count: 1, description: '1 sabor',   maxSizes: ['24cm','33cm'] },
  { id: 'mitad',  label: 'Mitad y Mitad', count: 2, description: '2 sabores', maxSizes: ['24cm','33cm'] },
  { id: 'tres',   label: '3 Sabores',     count: 3, description: '3 sabores', maxSizes: ['33cm'] },
  { id: 'cuatro', label: '4 Sabores',     count: 4, description: '4 sabores', maxSizes: ['33cm'] },
];

// ── Steps ─────────────────────────────────────────────────────────────────
// Sweet pizzas skip the Toppings step
const STEPS_SAVORY = ['tamano', 'division', 'sabores', 'toppings', 'confirmar'];
const STEPS_DULCE  = ['tamano', 'division', 'sabores', 'confirmar'];
const STEP_LABELS  = {
  tamano:   'Tamaño',
  division: 'División',
  sabores:  'Sabores',
  toppings: 'Toppings',
  confirmar:'Confirmar',
};

// ── Topping price key based on size + portion count ───────────────────────
function priceKeyFor(count, size) {
  if (size === '24cm') {
    // 24cm has no third/quarter tier — half covers divided portions
    return count === 1 ? 'price_full_24cm' : 'price_half_24cm';
  }
  // 33cm
  if (count === 1) return 'price_full_33cm';
  if (count === 2) return 'price_half_33cm';
  if (count === 3) return 'price_third_33cm';
  return 'price_quarter_33cm';
}

// ── Slide animation ────────────────────────────────────────────────────────
const slide = {
  initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -24 }, transition: { duration: 0.18, ease: 'easeOut' },
};

// ── Helpers ───────────────────────────────────────────────────────────────
function getPizzaPrice(item, sizeId) {
  return sizeId === '24cm' ? (item.price_23cm ?? item.price) : item.price;
}
function buildPizzaOptions(allItems, category) {
  const seen = new Map();
  (allItems || [])
    .filter(i => i.category === category && i.available !== false)
    .forEach(i => { if (!seen.has(i.name)) seen.set(i.name, { ...i }); });
  return Array.from(seen.values());
}
function divisionFromCount(n) {
  return DIVISIONS.find(d => d.count === n) || DIVISIONS[0];
}

// ── SVG: pizza decoration (División cards) ────────────────────────────────
function DecorationPizza({ count, size = 80, selected }) {
  const cx = size / 2, cy = size / 2;
  const ro = size * 0.46, ri = size * 0.38, lw = Math.max(1.5, size * 0.028);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={ro} fill="#d4a853" />
      <circle cx={cx} cy={cy} r={ri} fill={selected ? 'hsl(142 52% 96%)' : '#fdf6e3'} />
      {count === 2 && <line x1={cx} y1={cy - ri} x2={cx} y2={cy + ri} stroke="white" strokeWidth={lw} strokeLinecap="round" />}
      {count === 3 && <>
        <line x1={cx} y1={cy} x2={cx}                    y2={cy - ri}           stroke="white" strokeWidth={lw} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={cx + ri * 0.866} y2={cy + ri * 0.5} stroke="white" strokeWidth={lw} strokeLinecap="round" />
        <line x1={cx} y1={cy} x2={cx - ri * 0.866} y2={cy + ri * 0.5} stroke="white" strokeWidth={lw} strokeLinecap="round" />
      </>}
      {count === 4 && <>
        <line x1={cx} y1={cy - ri} x2={cx} y2={cy + ri} stroke="white" strokeWidth={lw} strokeLinecap="round" />
        <line x1={cx - ri} y1={cy} x2={cx + ri} y2={cy} stroke="white" strokeWidth={lw} strokeLinecap="round" />
      </>}
    </svg>
  );
}

// ── SVG: interactive pizza (Sabores step) ─────────────────────────────────
function InteractivePizza({ count, flavors, onSlotClick, size = 230 }) {
  const cx = size / 2, cy = size / 2;
  const crustR = size * 0.47, baseR = size * 0.40, btnR = size * 0.085, lw = Math.max(2, size * 0.025);
  const slicePath = (i, total) => {
    const step = (2 * Math.PI) / total, start = -Math.PI / 2 + i * step, end = start + step;
    const x1 = cx + baseR * Math.cos(start), y1 = cy + baseR * Math.sin(start);
    const x2 = cx + baseR * Math.cos(end),   y2 = cy + baseR * Math.sin(end);
    return `M${cx},${cy} L${x1},${y1} A${baseR},${baseR},0,${step > Math.PI ? 1 : 0},1,${x2},${y2}Z`;
  };
  const sliceCenter = (i, total) => {
    if (total === 1) return { x: cx, y: cy };
    const step = (2 * Math.PI) / total, mid = -Math.PI / 2 + (i + 0.5) * step;
    return { x: cx + baseR * 0.54 * Math.cos(mid), y: cy + baseR * 0.54 * Math.sin(mid) };
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }}>
      <circle cx={cx} cy={cy} r={crustR} fill="#d4a853" />
      <circle cx={cx} cy={cy} r={baseR}  fill="#fdf6e3" />
      {Array.from({ length: count }).map((_, i) => {
        const { x, y } = sliceCenter(i, count);
        const flavor = flavors[i], color = SLOT_COLORS[i], filled = !!flavor;
        return (
          <g key={i} onClick={() => onSlotClick(i)} style={{ cursor: 'pointer' }}>
            {count === 1
              ? <circle cx={cx} cy={cy} r={baseR} fill={filled ? color + '30' : 'transparent'} />
              : <path d={slicePath(i, count)} fill={filled ? color + '2a' : 'transparent'}
                  stroke="white" strokeWidth={lw} strokeLinejoin="round" />
            }
            <circle cx={x} cy={y} r={btnR} fill="white" fillOpacity={0.95} />
            {filled ? (
              <>
                <circle cx={x} cy={y} r={btnR} fill="none" stroke={color} strokeWidth={lw * 0.7} />
                <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
                  fontSize={btnR * 0.95} fontWeight="700" fill={color}>✓</text>
              </>
            ) : (
              <>
                <circle cx={x} cy={y} r={btnR} fill="none"
                  stroke="#d4a853" strokeWidth={lw * 0.6} strokeDasharray="3 2.5" />
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="central"
                  fontSize={btnR * 1.3} fill="#d4a853">+</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────
function WizardStepper({ steps, currentIndex }) {
  return (
    <div className="flex items-start justify-center gap-0 px-4 py-3">
      {steps.map((stepId, i) => {
        const done = i < currentIndex, active = i === currentIndex;
        return (
          <React.Fragment key={stepId}>
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done   ? 'bg-amber-400 text-white shadow-sm' :
                active ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20' :
                         'bg-muted text-muted-foreground'
              }`}>
                {done ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
              </div>
              <span className={`text-[9px] font-semibold leading-tight text-center whitespace-nowrap ${
                active ? 'text-primary' : done ? 'text-amber-500' : 'text-muted-foreground'
              }`}>{STEP_LABELS[stepId]}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-8 sm:w-10 mt-3.5 mx-0.5 flex-shrink-0 rounded-full transition-colors ${
                i < currentIndex ? 'bg-amber-400' : 'bg-border'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Flavor picker (Sabores step) ──────────────────────────────────────────
function FlavorPickerPanel({ slot, pizzaOptions, flavors, selectedSize, onPick, onClose }) {
  const [search, setSearch] = useState('');

  // Determine per-item size availability based on the chosen size
  const isSizeAvail = (pizza) => {
    if (!selectedSize) return true;
    const key = selectedSize === '24cm' ? 'available_24cm' : 'available_33cm';
    return pizza[key] !== false;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? pizzaOptions.filter(p => p.name.toLowerCase().includes(q)) : pizzaOptions;
    // Available items first, unavailable at bottom
    return [...list].sort((a, b) => {
      const aOk = isSizeAvail(a) ? 0 : 1;
      const bOk = isSizeAvail(b) ? 0 : 1;
      return aOk - bOk;
    });
  }, [pizzaOptions, search, selectedSize]);

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 bg-background rounded-t-2xl shadow-2xl flex flex-col"
      style={{ zIndex: 70, maxHeight: '72vh' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
        <div>
          <h3 className="font-heading font-semibold text-foreground">Elige el sabor</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SLOT_COLORS[slot] }} />
            <span className="text-xs text-muted-foreground font-medium">Porción {slot + 1}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-5 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar sabor..."
            className="w-full text-sm bg-muted/40 border border-border/50 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60" />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 px-5 pb-8 space-y-1.5">
        {filtered.map(pizza => {
          const avail       = isSizeAvail(pizza);
          const inThisSlot  = flavors[slot]?.item?.name === pizza.name;
          const inOtherSlot = !inThisSlot && flavors.some(f => f?.item?.name === pizza.name);
          if (!avail) {
            return (
              <div key={pizza.name}
                className="w-full flex items-center gap-3 rounded-xl px-4 py-3 border border-red-200 bg-red-50/60 text-sm select-none opacity-70">
                <span className="flex-1 font-medium truncate text-red-700">{pizza.name.replace(/^Pizza /i, '')}</span>
                <span className="text-[11px] font-semibold text-red-500 whitespace-nowrap">No disponible en esa talla</span>
              </div>
            );
          }
          return (
            <button key={pizza.name} onClick={() => onPick(pizza)}
              className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 border text-sm text-left transition-all ${
                inThisSlot  ? 'border-primary bg-primary/8 text-primary' :
                inOtherSlot ? 'border-border/30 bg-muted/20 text-muted-foreground' :
                              'border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5'
              }`}>
              <span className="flex-1 font-medium truncate">{pizza.name.replace(/^Pizza /i, '')}</span>
              {inThisSlot && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Topping picker (Toppings step) ────────────────────────────────────────
const PRICE_KEY_LABELS = {
  price_full_33cm:    'pizza entera (33cm)',
  price_half_33cm:    'media pizza (33cm)',
  price_third_33cm:   'tercio de pizza (33cm)',
  price_quarter_33cm: 'cuarto de pizza (33cm)',
  price_full_24cm:    'pizza entera (24cm)',
  price_half_24cm:    'media pizza (24cm)',
};

function ToppingPickerPanel({ slot, flavorName, allToppings, slotToppings, priceKey, onToggle, onClose }) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? allToppings.filter(t => t.name.toLowerCase().includes(q)) : allToppings;
  }, [allToppings, search]);
  const isSelected = (id) => slotToppings.some(t => t.id === id);
  const atLimit = slotToppings.length >= MAX_TOPPINGS_PER_SLOT;

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-x-0 bottom-0 bg-background rounded-t-2xl shadow-2xl flex flex-col"
      style={{ zIndex: 70, maxHeight: '82vh' }}>

      {/* Header */}
      <div className="flex items-start justify-between px-5 py-4 border-b flex-shrink-0">
        <div>
          <h3 className="font-heading font-semibold text-foreground">Elige toppings</h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: SLOT_COLORS[slot] }} />
            <span className="text-xs text-muted-foreground font-medium truncate max-w-[180px]">
              {flavorName.replace(/^Pizza /i, '')} · Porción {slot + 1}
            </span>
          </div>
          {/* Portion price tier badge */}
          <span className="inline-flex items-center mt-1.5 text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
            Precios por {PRICE_KEY_LABELS[priceKey]}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 mt-0.5">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            atLimit ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
          }`}>{slotToppings.length}/{MAX_TOPPINGS_PER_SLOT}</span>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar topping..."
            className="w-full text-sm bg-muted/40 border border-border/50 rounded-xl pl-9 pr-3 py-2.5 outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground/60" />
        </div>
      </div>

      {/* Topping list — single column for clear price visibility */}
      <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-1.5 pt-1">
        {filtered.map(topping => {
          const sel = isSelected(topping.id);
          const disabled = atLimit && !sel;
          const price = parseFloat(topping[priceKey] || 0);
          return (
            <button key={topping.id} onClick={() => !disabled && onToggle(topping)}
              disabled={disabled}
              className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 border-2 text-sm text-left transition-all ${
                sel     ? 'border-primary bg-primary/8' :
                disabled? 'border-border/20 bg-muted/10 opacity-40 cursor-not-allowed' :
                          'border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5'
              }`}>
              {/* Name */}
              <span className={`font-medium flex-1 ${sel ? 'text-primary' : 'text-foreground'}`}>
                {topping.name}
              </span>
              {/* Price + check */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`font-semibold tabular-nums ${sel ? 'text-primary' : 'text-muted-foreground'}`}>
                  +{price.toFixed(2)} €
                </span>
                {sel
                  ? <Check className="w-4 h-4 text-primary" />
                  : <Plus className="w-4 h-4 text-muted-foreground/40" />
                }
              </div>
            </button>
          );
        })}
      </div>

      {/* Confirm button */}
      <div className="px-5 pb-6 pt-3 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm py-3 rounded-xl transition-colors"
        >
          {slotToppings.length > 0 ? `Listo · ${slotToppings.length} topping${slotToppings.length > 1 ? 's' : ''} añadido${slotToppings.length > 1 ? 's' : ''}` : 'Sin toppings extra'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────
export default function PizzaWizard({ item, onClose, onConfirm, initialValues }) {
  const isDulce = item.category === 'pizzas_dulces';
  const STEPS   = isDulce ? STEPS_DULCE : STEPS_SAVORY;

  // ── Fetch data ─────────────────────────────────────────────────────────
  const { data: allItems   = [] } = useQuery({ queryKey: ['menuItems'], queryFn: fetchMenuItems, staleTime: 60_000 });
  const { data: allToppings = [] } = useQuery({ queryKey: ['toppings'],  queryFn: fetchToppings,  staleTime: 60_000 });

  const pizzaOptions = useMemo(
    () => buildPizzaOptions(allItems.length ? allItems : [item], item.category),
    [allItems, item.category]
  );

  // ── State ──────────────────────────────────────────────────────────────
  const initDivision = initialValues?.flavors?.length
    ? divisionFromCount(initialValues.flavors.length) : null;
  const initFlavors = useMemo(() => {
    if (initialValues?.flavors?.length)
      return initialValues.flavors.map(f => ({ item: f._itemObj || f }));
    return [{ item }];
  }, []);

  const [stepIndex,     setStepIndex]     = useState(0);
  const [selectedSize,  setSelectedSize]  = useState(initialValues?.size || null);
  const [division,      setDivision]      = useState(initDivision);
  const [flavors,       setFlavors]       = useState(() =>
    Array(4).fill(null).map((_, i) => initFlavors[i] || null)
  );
  const [flavorToppings, setFlavorToppings] = useState(() => {
    const base = Array(4).fill(null).map(() => []);
    if (initialValues?.toppings) {
      initialValues.toppings.forEach((tops, i) => { base[i] = tops || []; });
    }
    return base;
  });
  const [pickingSlot,   setPickingSlot]   = useState(null); // flavor picker
  const [toppingSlot,   setToppingSlot]   = useState(null); // topping picker

  const currentStep  = STEPS[stepIndex];
  const sizeInfo     = MF_SIZES.find(s => s.id === selectedSize) || MF_SIZES[1];
  const flavorCount  = division?.count || 1;
  const activeFlavors = flavors.slice(0, flavorCount);
  const allSlotsFilled = activeFlavors.every(Boolean);
  const priceKey     = priceKeyFor(flavorCount, selectedSize);

  // ── Pricing ────────────────────────────────────────────────────────────
  const filledFlavors = activeFlavors.filter(Boolean);
  const basePrice = filledFlavors.length
    ? Math.max(...filledFlavors.map(f => getPizzaPrice(f.item, selectedSize)))
    : getPizzaPrice(item, selectedSize);

  const getTopPrice = (toppingId) => {
    const t = allToppings.find(t => t.id === toppingId);
    return t ? parseFloat(t[priceKey] || 0) : 0;
  };
  const toppingsTotal = flavorToppings
    .slice(0, flavorCount)
    .reduce((sum, tops) => sum + tops.reduce((s, t) => s + getTopPrice(t.id), 0), 0);
  const finalPrice = basePrice + toppingsTotal;

  // ── Size / division helpers ────────────────────────────────────────────
  const isDivisionDisabled = (div) => selectedSize ? !div.maxSizes.includes(selectedSize) : false;

  const handleSizeSelect = (sizeId) => {
    setSelectedSize(sizeId);
    // reset 3- and 4-sabores division if switching to 24cm
    if (sizeId === '24cm' && (division?.count === 3 || division?.count === 4)) {
      setDivision(null);
      setFlavors(Array(4).fill(null).map((_, i) => i === 0 ? { item } : null));
      setFlavorToppings(Array(4).fill(null).map(() => []));
    }
  };

  const selectDivision = (div) => {
    setDivision(div);
    setFlavors(prev => Array(4).fill(null).map((_, i) => prev[i] || null).map((f, i) => i === 0 ? (f || { item }) : f));
  };

  // ── Flavor slot ────────────────────────────────────────────────────────
  const pickFlavor = (pizza) => {
    setFlavors(prev => { const n = [...prev]; n[pickingSlot] = { item: pizza }; return n; });
    setPickingSlot(null);
  };

  // ── Topping slot ───────────────────────────────────────────────────────
  const toggleTopping = (slotIdx, topping) => {
    setFlavorToppings(prev => {
      const next = prev.map(arr => [...arr]);
      const slot = next[slotIdx];
      const idx  = slot.findIndex(t => t.id === topping.id);
      if (idx >= 0) slot.splice(idx, 1);
      else if (slot.length < MAX_TOPPINGS_PER_SLOT) slot.push({ id: topping.id, name: topping.name });
      return next;
    });
  };

  // ── Navigation ─────────────────────────────────────────────────────────
  const canNext = () => {
    if (currentStep === 'tamano')   return !!selectedSize;
    if (currentStep === 'division') return !!division;
    if (currentStep === 'sabores')  return allSlotsFilled;
    if (currentStep === 'toppings') return true; // optional
    return false;
  };
  const goNext = () => setStepIndex(i => Math.min(i + 1, STEPS.length - 1));
  const goBack = () => { if (stepIndex === 0) { onClose(); return; } setStepIndex(i => i - 1); };

  // ── Confirm ────────────────────────────────────────────────────────────
  const handleConfirm = () => {
    onConfirm({
      size:      selectedSize,
      division,
      flavors:   activeFlavors.filter(Boolean),
      toppings:  flavorToppings.slice(0, flavorCount).map(tops =>
        tops.map(t => ({ id: t.id, name: t.name, price: getTopPrice(t.id) }))
      ),
      basePrice,
      finalPrice,
    });
  };

  const sizeCardPrice = (sizeId) => {
    const p = sizeId === '24cm' ? item.price_23cm : item.price;
    return p != null ? `${parseFloat(p).toFixed(2)} €` : '—';
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <motion.div
          initial={{ y: 48, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          exit={{ y: 48, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative bg-background w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl"
          style={{ maxHeight: '92vh' }}
          onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-0 flex-shrink-0">
            <h2 className="font-heading font-bold text-lg text-foreground tracking-tight">Diseña tu Pizza</h2>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Stepper */}
          <div className="flex-shrink-0 border-b">
            <WizardStepper steps={STEPS} currentIndex={stepIndex} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait" initial={false}>

              {/* ── Tamaño ────────────────────────────────────────────── */}
              {currentStep === 'tamano' && (
                <motion.div key="tamano" {...slide} className="p-5">
                  <h3 className="font-heading text-xl font-semibold mb-1">Elige tu tamaño</h3>
                  <p className="text-sm text-muted-foreground mb-5">Nuestras pizzas están hechas a mano con masa madre.</p>
                  <div className="grid grid-cols-2 gap-3">
                    {MF_SIZES.map(size => {
                      const availKey = size.id === '24cm' ? 'available_24cm' : 'available_33cm';
                      const sizeAvail = item[availKey] !== false;
                      const sel = selectedSize === size.id;
                      if (!sizeAvail) {
                        return (
                          <div key={size.id} className="rounded-2xl p-4 text-left border-2 border-border/30 bg-muted/20 opacity-60 select-none">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-heading font-bold text-base text-muted-foreground">{size.label}</span>
                              <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">{size.cm}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-3">{size.serves}</p>
                            <span className="text-xs font-semibold text-red-400">Agotado</span>
                          </div>
                        );
                      }
                      return (
                        <button key={size.id} onClick={() => handleSizeSelect(size.id)}
                          className={`rounded-2xl p-4 text-left border-2 transition-all ${
                            sel ? 'border-primary bg-primary/8 shadow-sm' : 'border-border/50 bg-card hover:border-primary/40 hover:bg-muted/30'
                          }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-heading font-bold text-base">{size.label}</span>
                            <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">{size.cm}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-3">{size.serves}</p>
                          <div className="flex items-end justify-between gap-1">
                            <p className={`text-[11px] font-semibold ${sel ? 'text-primary/80' : 'text-muted-foreground'}`}>
                              Máx. {size.maxFlavors} sabores
                            </p>
                            <span className={`font-heading font-bold text-base whitespace-nowrap ${sel ? 'text-primary' : 'text-foreground'}`}>
                              {sizeCardPrice(size.id)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── División ──────────────────────────────────────────── */}
              {currentStep === 'division' && (
                <motion.div key="division" {...slide} className="p-5">
                  <h3 className="font-heading text-xl font-semibold mb-1">¿Cuántos sabores?</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Elige cómo dividir tu pizza{selectedSize ? ` de ${selectedSize}` : ''}.
                  </p>
                  <div className="space-y-3">
                    {DIVISIONS.map(div => {
                      const disabled = isDivisionDisabled(div), sel = division?.id === div.id;
                      return (
                        <button key={div.id} onClick={() => !disabled && selectDivision(div)} disabled={disabled}
                          className={`w-full flex items-center gap-4 rounded-2xl p-4 border-2 text-left transition-all ${
                            disabled ? 'border-border/20 bg-muted/20 opacity-40 cursor-not-allowed' :
                            sel      ? 'border-primary bg-primary/8 shadow-sm' :
                                       'border-border/50 bg-card hover:border-primary/40 hover:bg-muted/20'
                          }`}>
                          <div className="flex-shrink-0"><DecorationPizza count={div.count} size={76} selected={sel} /></div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-heading font-semibold text-base ${sel ? 'text-primary' : 'text-foreground'}`}>{div.label}</p>
                            <p className="text-sm text-muted-foreground">{div.description}</p>
                            {disabled && <p className="text-xs text-amber-600 mt-1 font-medium">Solo disponible en pizza Grande (33 cm)</p>}
                          </div>
                          {sel && <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3} /></div>}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* ── Sabores ───────────────────────────────────────────── */}
              {currentStep === 'sabores' && division && (
                <motion.div key="sabores" {...slide} className="p-5">
                  <h3 className="font-heading text-xl font-semibold mb-1">Añade los sabores</h3>
                  <p className="text-sm text-muted-foreground mb-4">Toca cada porción para elegir su sabor.</p>
                  <div className="flex justify-center mb-6">
                    <InteractivePizza count={flavorCount} flavors={activeFlavors} onSlotClick={setPickingSlot} size={220} />
                  </div>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Tu selección</p>
                  <div className="space-y-2">
                    {activeFlavors.map((f, i) => (
                      <button key={i} onClick={() => setPickingSlot(i)}
                        className={`w-full flex items-center gap-3 rounded-xl px-4 py-3.5 border text-left transition-all ${
                          f ? 'border-border/50 bg-card hover:border-primary/40 hover:shadow-sm' : 'border-dashed border-border/60 bg-muted/20 hover:border-primary/40'
                        }`}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: SLOT_COLORS[i] }}>{i + 1}</div>
                        {f ? (
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{f.item.name}</p>
                            {f.item.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{f.item.description}</p>}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground/70 flex-1 italic">Toca para elegir sabor…</p>
                        )}
                        <Plus className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Toppings ──────────────────────────────────────────── */}
              {currentStep === 'toppings' && (
                <motion.div key="toppings" {...slide} className="p-5">
                  <h3 className="font-heading text-xl font-semibold mb-1">Añade toppings</h3>
                  <p className="text-sm text-muted-foreground mb-1">
                    Opcional · hasta {MAX_TOPPINGS_PER_SLOT} toppings por porción.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mb-5">
                    Los precios se calculan por tu{' '}
                    {flavorCount === 1 ? 'pizza entera' : flavorCount === 2 ? 'media pizza' : flavorCount === 3 ? 'tercio de pizza' : 'cuarto de pizza'}.
                  </p>

                  <div className="space-y-3">
                    {activeFlavors.filter(Boolean).map((f, i) => {
                      const slotTops = flavorToppings[i] || [];
                      const slotTotal = slotTops.reduce((s, t) => s + getTopPrice(t.id), 0);
                      const atLimit = slotTops.length >= MAX_TOPPINGS_PER_SLOT;
                      return (
                        <div key={i} className="rounded-2xl border border-border/50 bg-card overflow-hidden">
                          {/* Flavor header */}
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ backgroundColor: SLOT_COLORS[i] }}>{i + 1}</div>
                            <p className="font-semibold text-sm flex-1 truncate">{f.item.name.replace(/^Pizza /i, '')}</p>
                            {slotTotal > 0 && (
                              <span className="text-xs text-primary font-semibold whitespace-nowrap">+{slotTotal.toFixed(2)} €</span>
                            )}
                          </div>

                          {/* Selected toppings pills */}
                          <div className="px-4 py-3">
                            {slotTops.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {slotTops.map(t => (
                                  <button key={t.id}
                                    onClick={() => toggleTopping(i, t)}
                                    className="flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/30 rounded-full px-2.5 py-1 font-medium hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
                                    {t.name} · +{getTopPrice(t.id).toFixed(2)} €
                                    <X className="w-3 h-3" />
                                  </button>
                                ))}
                              </div>
                            )}
                            <button onClick={() => setToppingSlot(i)} disabled={atLimit}
                              className={`flex items-center gap-2 text-sm font-medium rounded-xl px-3 py-2 border transition-all ${
                                atLimit
                                  ? 'border-border/20 text-muted-foreground/40 cursor-not-allowed bg-muted/10'
                                  : 'border-primary/40 text-primary hover:bg-primary/5 bg-primary/5'
                              }`}>
                              <Plus className="w-3.5 h-3.5" />
                              {slotTops.length === 0 ? 'Añadir topping' : atLimit ? 'Máximo alcanzado' : 'Añadir otro'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total toppings cost */}
                  {toppingsTotal > 0 && (
                    <div className="mt-4 flex items-center justify-between px-1">
                      <span className="text-sm text-muted-foreground">Total toppings</span>
                      <span className="font-semibold text-primary">+{toppingsTotal.toFixed(2)} €</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Confirmar ─────────────────────────────────────────── */}
              {currentStep === 'confirmar' && (
                <motion.div key="confirmar" {...slide} className="p-5">
                  <h3 className="font-heading text-xl font-semibold mb-1">Tu Creación</h3>
                  <p className="text-sm text-muted-foreground mb-5">Revisa tu pizza antes de añadirla al pedido.</p>

                  <div className="bg-card border border-border/50 rounded-2xl overflow-hidden shadow-sm mb-5">
                    {/* Summary header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
                      <div>
                        <p className="font-heading font-bold text-foreground">
                          {sizeInfo.label}{' '}
                          <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-1">{sizeInfo.cm}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">{division?.label} · {division?.description}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-heading font-bold text-2xl text-primary">{finalPrice.toFixed(2)} €</span>
                        {toppingsTotal > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">base {basePrice.toFixed(2)} € + toppings {toppingsTotal.toFixed(2)} €</p>
                        )}
                      </div>
                    </div>

                    {/* Per-flavor breakdown */}
                    <div className="px-5 py-4 space-y-4">
                      {activeFlavors.filter(Boolean).map((f, i) => {
                        const slotTops = flavorToppings[i] || [];
                        return (
                          <div key={i}>
                            <div className="flex items-start gap-3">
                              <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: SLOT_COLORS[i] }} />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-foreground">{f.item.name}</p>
                                {f.item.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.item.description}</p>
                                )}
                                {slotTops.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {slotTops.map(t => (
                                      <span key={t.id} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border/40">
                                        {t.name} · +{getTopPrice(t.id).toFixed(2)} €
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button onClick={handleConfirm}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-12 text-base font-semibold gap-2 shadow-md">
                    <ShoppingCart className="w-5 h-5" />
                    Añadir al pedido · {finalPrice.toFixed(2)} €
                  </Button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Footer navigation */}
          {currentStep !== 'confirmar' ? (
            <div className="flex items-center justify-between px-5 py-4 border-t bg-background/95 flex-shrink-0"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={goBack} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-1">
                <ChevronLeft className="w-4 h-4" />Atrás
              </button>
              <Button onClick={goNext} disabled={!canNext()}
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-6 h-10 font-semibold gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
                {currentStep === 'toppings' ? 'Ver resumen' : 'Siguiente'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="px-5 py-4 border-t bg-background/95 flex-shrink-0"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
              <button onClick={goBack} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />Seguir editando
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Flavor picker panel */}
      <AnimatePresence>
        {pickingSlot !== null && (
          <>
            <div className="fixed inset-0 bg-black/30" style={{ zIndex: 65 }} onClick={() => setPickingSlot(null)} />
            <FlavorPickerPanel
              slot={pickingSlot} pizzaOptions={pizzaOptions} flavors={activeFlavors}
              selectedSize={selectedSize}
              onPick={pickFlavor} onClose={() => setPickingSlot(null)} />
          </>
        )}
      </AnimatePresence>

      {/* Topping picker panel */}
      <AnimatePresence>
        {toppingSlot !== null && (
          <>
            <div className="fixed inset-0 bg-black/30" style={{ zIndex: 65 }} onClick={() => setToppingSlot(null)} />
            <ToppingPickerPanel
              slot={toppingSlot}
              flavorName={activeFlavors[toppingSlot]?.item?.name || ''}
              allToppings={allToppings}
              slotToppings={flavorToppings[toppingSlot] || []}
              priceKey={priceKey}
              onToggle={(topping) => toggleTopping(toppingSlot, topping)}
              onClose={() => setToppingSlot(null)} />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
