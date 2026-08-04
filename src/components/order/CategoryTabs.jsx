import React from 'react';

const categories = [
  { value: 'all', label: 'Todas' },
  { value: 'pizzas', label: 'Nuestras Clásicas' },
  { value: 'pizzas_dulces', label: 'Pizzas Dulces' },
  { value: 'bebidas', label: 'Bebidas' },

];

export default function CategoryTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
      {categories.map(cat => (
        <button
          key={cat.value}
          onClick={() => onChange(cat.value)}
          className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-medium transition-all flex-shrink-0 ${
            active === cat.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );
}