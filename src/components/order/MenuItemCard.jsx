import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Ban } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { motion } from 'framer-motion';
import PizzaCustomizerModal from './PizzaCustomizerModal';

const isPizza = (category) => category === 'pizzas' || category === 'pizzas_dulces';
const isDrink = (category) => category === 'bebidas';

// Pizzas cuya foto ya viene bien encuadrada y NO necesita el zoom del 65%.
// Se muestran centradas normales. (nombre exacto tal cual en la BD)
const NO_ZOOM = ['Pizza Amsterdam', 'Pizza Carioca', 'Pizza Granjera'];

export default function MenuItemCard({ item }) {
  const { addItem } = useCart();
  const [showModal, setShowModal] = useState(false);

  // Disponibilidad. OrderMenu ya calcula available / available_23cm / available_33cm.
  const soldOut = item.available === false;
  const has23 = item.available_23cm !== false;
  const has33 = item.available_33cm !== false;
  const hasTwoSizes = isPizza(item.category) && item.price_23cm != null;
  // Un solo tamaño agotado (la pizza sigue pedible, pero no en ese tamaño)
  const partial = hasTwoSizes && !soldOut && (!has23 || !has33);

  // Bebidas: lata entera (contain). Pizzas de la lista NO_ZOOM: centrado normal.
  // Resto de pizzas: object-[center_65%] (recorta un poco el techo).
  const drink = isDrink(item.category);
  const noZoom = NO_ZOOM.includes(item.name);
  const imgFit = drink
    ? 'object-contain p-3'
    : (noZoom ? 'object-cover object-center' : 'object-cover object-[center_65%]');

  const handleAddClick = () => {
    if (soldOut) return; // seguro extra
    if (isPizza(item.category)) {
      setShowModal(true);
    } else {
      addItem({ ...item });
    }
  };

  const handleConfirm = ({ size, extras, removedIngredients, basePrice, finalPrice }) => {
    const sizeSuffix = size ? ` (${size})` : '';
    const extrasSuffix = extras.length > 0 ? ` + ${extras.map((e) => e.name).join(', ')}` : '';
    addItem({
      ...item,
      id: `${item.id}_${size || 'single'}_${Date.now()}`,
      name: `${item.name}${sizeSuffix}${extrasSuffix}`,
      price: finalPrice,
      removed_ingredients: removedIngredients.length > 0 ? removedIngredients : undefined,
      _size: size,
      _extras: extras,
      _originalItem: item,
    });
    setShowModal(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-card rounded-xl border overflow-hidden transition-all group relative ${
          soldOut
            ? 'border-border/40 opacity-70'
            : 'border-border/50 hover:shadow-md'
        }`}
      >
        {item.image_url && (
          <div className={`h-44 overflow-hidden flex items-center justify-center relative ${drink ? 'bg-white' : 'bg-muted/20'}`}>
            <img
              src={item.image_url}
              alt={item.name}
              loading="lazy"
              decoding="async"
              className={`w-full h-full ${imgFit} transition-transform duration-500 ${
                soldOut ? 'grayscale' : (drink ? '' : 'group-hover:scale-105')
              }`}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
            {soldOut && (
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <span className="bg-red-600 text-white font-heading font-bold text-sm tracking-wide px-4 py-1.5 rounded-full shadow-lg uppercase">
                  Agotada
                </span>
              </div>
            )}
          </div>
        )}

        {/* Si no hay imagen, el badge va arriba a la derecha */}
        {!item.image_url && soldOut && (
          <div className="absolute top-3 right-3 z-10">
            <span className="bg-red-600 text-white font-bold text-[10px] tracking-wide px-2.5 py-1 rounded-full shadow uppercase">
              Agotada
            </span>
          </div>
        )}

        <div className="p-4">
          <div className="flex justify-between items-start gap-2 mb-1.5">
            <h3 className={`font-heading font-semibold ${soldOut ? 'text-muted-foreground' : 'text-foreground'}`}>
              {item.name}
            </h3>
            <div className="text-right whitespace-nowrap flex-shrink-0">
              {hasTwoSizes ? (
                <div className="flex flex-col items-end text-xs gap-0.5">
                  <span className={`text-muted-foreground ${!has23 ? 'line-through opacity-50' : ''}`}>
                    24cm: <span className={`font-bold ${has23 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {item.price_23cm.toFixed(2)} €
                    </span>
                  </span>
                  <span className={`text-muted-foreground ${!has33 ? 'line-through opacity-50' : ''}`}>
                    33cm: <span className={`font-bold ${has33 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {item.price.toFixed(2)} €
                    </span>
                  </span>
                </div>
              ) : (
                <span className={`font-heading font-bold text-lg ${soldOut ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                  {item.price.toFixed(2)} €
                </span>
              )}
            </div>
          </div>

          {item.description && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{item.description}</p>
          )}

          {/* Aviso: solo un tamaño agotado */}
          {partial && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mb-2">
              <p className="text-amber-800 text-xs font-medium">
                ⚠️ Solo disponible en <strong>{has23 ? '24cm' : '33cm'}</strong>
              </p>
            </div>
          )}

          {soldOut ? (
            <Button
              disabled
              className="w-full rounded-lg gap-2 mt-2 bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted"
              size="sm"
            >
              <Ban className="w-4 h-4" />
              Agotada
            </Button>
          ) : (
            <Button
              onClick={handleAddClick}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg gap-2 mt-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              Añadir
            </Button>
          )}
        </div>
      </motion.div>

      {showModal && (
        <PizzaCustomizerModal
          item={item}
          onClose={() => setShowModal(false)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}
