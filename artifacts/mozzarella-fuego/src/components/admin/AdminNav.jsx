import React from 'react';
import { Package, BookOpen, UtensilsCrossed } from 'lucide-react';

const TABS = [
  { key: 'pedidos', label: 'Pedidos', icon: Package },
  { key: 'reservas', label: 'Reservas', icon: BookOpen },
  { key: 'carta', label: 'Carta', icon: UtensilsCrossed },
];

export default function AdminNav({ active, onChange }) {
  return (
    <div className="flex border-b border-border mb-6">
      {TABS.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}