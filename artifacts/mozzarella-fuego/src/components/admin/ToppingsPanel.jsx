import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, X, Check, Eye, EyeOff, Loader2 } from 'lucide-react';

const EMPTY = {
  name: '',
  available: true,
  price_full_33cm: '',
  price_half_33cm: '',
  price_quarter_33cm: '',
  price_full_24cm: '',
  price_half_24cm: '',
};

const PRICE_FIELDS = [
  { key: 'price_full_33cm',    label: 'Entera 33cm'   },
  { key: 'price_half_33cm',    label: 'Media 33cm'    },
  { key: 'price_quarter_33cm', label: 'Cuarto 33cm'   },
  { key: 'price_full_24cm',    label: 'Entera 24cm'   },
  { key: 'price_half_24cm',    label: 'Media 24cm'    },
];

function fmt(v) {
  const n = parseFloat(v);
  return isNaN(n) ? '—' : `${n.toFixed(2)} €`;
}

export default function ToppingsPanel() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);  // topping object
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const { data: toppings = [], isLoading } = useQuery({
    queryKey: ['admin-toppings'],
    queryFn: async () => {
      const res = await fetch('/api/admin/toppings', { credentials: 'include' });
      if (!res.ok) throw new Error('Error al cargar toppings');
      const { data } = await res.json();
      return data;
    },
  });

  const set = (field, val) => setForm(p => ({ ...p, [field]: val }));

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name:               t.name,
      available:          t.available !== false,
      price_full_33cm:    t.price_full_33cm ?? '',
      price_half_33cm:    t.price_half_33cm ?? '',
      price_quarter_33cm: t.price_quarter_33cm ?? '',
      price_full_24cm:    t.price_full_24cm ?? '',
      price_half_24cm:    t.price_half_24cm ?? '',
    });
    setShowForm(true);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-toppings'] });
    queryClient.invalidateQueries({ queryKey: ['toppings'] });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:               form.name.trim(),
        available:          form.available,
        price_full_33cm:    form.price_full_33cm    !== '' ? parseFloat(form.price_full_33cm)    : null,
        price_half_33cm:    form.price_half_33cm    !== '' ? parseFloat(form.price_half_33cm)    : null,
        price_quarter_33cm: form.price_quarter_33cm !== '' ? parseFloat(form.price_quarter_33cm) : null,
        price_full_24cm:    form.price_full_24cm    !== '' ? parseFloat(form.price_full_24cm)    : null,
        price_half_24cm:    form.price_half_24cm    !== '' ? parseFloat(form.price_half_24cm)    : null,
      };
      const url    = editing ? `/api/admin/toppings/${editing.id}` : '/api/admin/toppings';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      invalidate();
      setShowForm(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const res = await fetch(`/api/admin/toppings/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || `Error ${res.status}`);
      return;
    }
    invalidate();
    setDeletingId(null);
  };

  const toggleAvailable = async (t) => {
    await fetch(`/api/admin/toppings/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ available: !t.available }),
    });
    invalidate();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="gap-2 rounded-xl bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Añadir topping
        </Button>
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold">
              {editing ? 'Editar topping' : 'Nuevo topping'}
            </h3>
            <button onClick={() => setShowForm(false)}>
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Name */}
            <div>
              <Label className="mb-1 block text-xs">Nombre *</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
                className="rounded-xl"
                placeholder="Ej: Jalapeños"
              />
            </div>

            {/* 5 price fields — 2 columns */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Precios (€)</p>
              <div className="grid grid-cols-2 gap-3">
                {PRICE_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form[key]}
                      onChange={e => set(key, e.target.value)}
                      className="rounded-xl"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Available toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set('available', !form.available)}
                className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${
                  form.available ? 'bg-green-500' : 'bg-muted-foreground/30'
                }`}
              >
                <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${
                  form.available ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
              <Label className="text-xs">
                {form.available ? 'Disponible' : 'No disponible'}
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl bg-primary hover:bg-primary/90"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando…</>
                  : <><Check className="w-4 h-4 mr-1" /> Guardar</>}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                className="rounded-xl"
              >
                Cancelar
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="bg-muted rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : toppings.length === 0 ? (
        <div className="bg-muted/40 rounded-2xl p-8 text-center text-muted-foreground">
          No hay toppings. Pulsa "Añadir topping" para empezar.
        </div>
      ) : (
        <div className="space-y-2">
          {toppings.map(t => (
            <div
              key={t.id}
              className={`bg-card rounded-xl border border-border/50 p-3 transition-opacity ${
                !t.available ? 'opacity-50' : ''
              }`}
            >
              {/* Top row: name + actions */}
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm flex-1 min-w-0 truncate">{t.name}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleAvailable(t)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    title={t.available ? 'Deshabilitar' : 'Habilitar'}
                  >
                    {t.available
                      ? <Eye className="w-4 h-4 text-green-600" />
                      : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <button
                    onClick={() => openEdit(t)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {deletingId === t.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 transition-colors"
                      >
                        <Check className="w-4 h-4 text-red-700" />
                      </button>
                      <button
                        onClick={() => setDeletingId(null)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingId(t.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>

              {/* Price grid */}
              <div className="mt-2 grid grid-cols-5 gap-1">
                {PRICE_FIELDS.map(({ key, label }) => (
                  <div key={key} className="text-center">
                    <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
                    <p className="text-xs font-semibold text-foreground">{fmt(t[key])}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
