import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Minus } from 'lucide-react';

export default function IngredientRemover({ ingredients, selected, onChange }) {
  const [open, setOpen] = useState(false);

  if (!ingredients || ingredients.length === 0) return null;

  const toggle = (ingredient) => {
    if (selected.includes(ingredient)) {
      onChange(selected.filter(i => i !== ingredient));
    } else {
      onChange([...selected, ingredient]);
    }
  };

  return (
    <div className="mt-3 border border-border/60 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
      >
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground/80">
          <Minus className="w-3.5 h-3.5 text-primary" />
          Quitar ingredientes
          {selected.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">
              {selected.length}
            </span>
          )}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-3 py-2 bg-background space-y-1.5">
          {ingredients.map(ingredient => {
            const isChecked = selected.includes(ingredient);
            return (
              <label
                key={ingredient}
                className={`flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 transition-colors ${
                  isChecked ? 'bg-amber-50 text-amber-700' : 'hover:bg-muted/50 text-foreground/80'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggle(ingredient)}
                  className="w-4 h-4 accent-amber-500 cursor-pointer flex-shrink-0"
                />
                <span className="text-sm">{ingredient}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}