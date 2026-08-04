import React, { useState } from 'react';
import { db } from '@/lib/db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, X, Check, Eye, EyeOff } from 'lucide-react';
import AvailabilitySection from '@/components/admin/AvailabilitySection';

const CATEGORIES = [
  { value: 'pizzas', label: '🍕 Pizzas' },
  { value: 'pizzas_dulces', label: '🍫 Pizzas dulces' },
  { value: 'bebidas', label: '🥤 Bebidas' },
  { value: 'cocteles', label: '🍹 Cócteles' },
];

const EMPTY_FORM = { name: '', description: '', price: '', price_23cm: '', category: 'pizzas', image_url: '', available: true };

export default function AdminMenu() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-menu'],
    queryFn: () => db.select('menu_items', {}),
  });

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || '',
      price: item.price,
      price_23cm: item.price_23cm || '',
      category: item.category,
      image_url: item.image_url || '',
      available: item.available !== false,
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      price_23cm: form.price_23cm ? parseFloat(form.price_23cm) : null,
      category: form.category,
      image_url: form.image_url || null,
      available: form.available,
    };
    if (editing) {
      await db.update('menu_items', editing.id, payload);
    } else {
      await db.insert('menu_items', payload);
    }
    queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    await fetch('/api/supabaseProxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_one', table: 'menu_items', id }),
    });
    queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
    setDeletingId(null);
  };

  const toggleAvailable = async (item) => {
    await db.update('menu_items', item.id, { available: !item.available });
    queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
  };

  // Ordenar por sort_order
  const sorted = [...items].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    items: sorted.filter(i => i.category === cat.value),
  })).filter(g => g.items.length > 0);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="gap-2 rounded-xl bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Añadir producto
        </Button>
      </div>

      <AvailabilitySection />

      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">Nombre *</Label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} required className="rounded-xl" />
              </div>
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">Descripción</Label>
                <Input value={form.description} onChange={e => update('description', e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Precio (€) *</Label>
                <Input type="number" step="0.01" min="0" value={form.price} onChange={e => update('price', e.target.value)} required className="rounded-xl" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Precio 23cm (€)</Label>
                <Input type="number" step="0.01" min="0" placeholder="Solo pizzas" value={form.price_23cm} onChange={e => update('price_23cm', e.target.value)} className="rounded-xl" />
              </div>
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">URL de imagen</Label>
                {form.image_url && (
                  <img src={form.image_url} alt="preview" className="w-full h-32 object-cover rounded-xl mb-1" onError={e => e.target.style.display='none'} />
                )}
                <Input value={form.image_url} onChange={e => update('image_url', e.target.value)} placeholder="https://..." className="rounded-xl" />
              </div>
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">Categoría *</Label>
                <Select value={form.category} onValueChange={val => update('category', val)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving} className="flex-1 rounded-xl bg-primary hover:bg-primary/90">
                {saving ? 'Guardando...' : <><Check className="w-4 h-4 mr-1" /> Guardar</>}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-muted rounded-xl h-16 animate-pulse" />)}</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.value}>
              <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-2">{group.label}</h3>
              <div className="space-y-2">
                {group.items.map(item => (
                  <div key={item.id} className={`bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3 ${!item.available ? 'opacity-50' : ''}`}>
                    {item.image_url && (
                      <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.price?.toFixed(2)} €
                        {item.price_23cm && ` · ${item.price_23cm?.toFixed(2)} € (23cm)`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => toggleAvailable(item)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title={item.available ? 'Deshabilitar' : 'Habilitar'}>
                        {item.available ? <Eye className="w-4 h-4 text-green-600" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {deletingId === item.id ? (
                        <div className="flex gap-1">
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 transition-colors">
                            <Check className="w-4 h-4 text-red-700" />
                          </button>
                          <button onClick={() => setDeletingId(null)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                            <X className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(item.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
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