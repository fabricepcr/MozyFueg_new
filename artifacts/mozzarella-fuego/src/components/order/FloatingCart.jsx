import React from 'react';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function FloatingCart() {
  const { itemCount, total, setIsOpen } = useCart();

  if (itemCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.button
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        onClick={() => setIsOpen(true)}
        className="fixed left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-40 bg-primary text-primary-foreground rounded-2xl p-4 shadow-2xl shadow-primary/30 flex items-center justify-between sm:gap-6 hover:bg-primary/90 transition-colors bottom-safe"
        style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingBag className="w-6 h-6" />
            <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
              {itemCount}
            </span>
          </div>
          <span className="font-semibold">Ver carrito</span>
        </div>
        <span className="font-heading font-bold text-lg">{total.toFixed(2)} €</span>
      </motion.button>
    </AnimatePresence>
  );
}