import React, { useRef, useState } from 'react';
import { db } from '@/lib/db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, X, Check, Eye, EyeOff, Upload, Loader2 } from 'lucide-react';
import ToppingsPanel from './ToppingsPanel';

const CATEGORIES = [
  { value: 'pizzas',        label: '🍕 Pizzas' },
  { value: 'pizzas_dulces', label: '🍫 Pizzas dulces' },
  { value: 'bebidas',       label: '🥤 Bebidas' },
  { value: 'cocteles',      label: '🍹 Cócteles' },
];

const EMPTY_FORM = {
  name: '', description: '', price: '', price_23cm: '',
  category: 'pizzas', image_url: '', available: true,
};

export default function AdminMenu() {
  const queryClient = useQueryClient();
  const [tab, setTab]               = useState('productos'); // 'productos' | 'toppings'
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploading, setUploading]   = useState(false);
  const fileInputRef                = useRef(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin-menu'],
    queryFn: () => db.select('menu_items', {}),
  });

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit   = (item) => {
    setEditing(item);
    setForm({
      name:        item.name,
      description: item.description || '',
      price:       item.price ?? '',
      price_23cm:  item.price_23cm ?? '',
      category:    item.category,
      image_url:   item.image_url || '',
      available:   item.available !== false,
    });
    setShowForm(true);
  };

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      // Step 1: get presigned URL from server (session cookie sent automatically)
      const metaRes = await fetch('/api/admin/uploadImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!metaRes.ok) throw new Error('Error al obtener URL de subida');
      const { uploadURL, objectPath, imageUrl } = await metaRes.json();

      // Step 2: PUT file directly to GCS
      const putRes = await fetch(uploadURL, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error('Error al subir la imagen');

      // Step 3: mark image as public so it can be served without auth
      const publishRes = await fetch('/api/admin/publishImage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ objectPath }),
      });
      if (!publishRes.ok) {
        const body = await publishRes.json().catch(() => ({}));
        throw new Error(body.error || 'Error al publicar la imagen');
      }

      update('image_url', imageUrl);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  // ── Save (create / update) ────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || null,
        price:       parseFloat(form.price),
        price_23cm:  form.price_23cm !== '' ? parseFloat(form.price_23cm) : null,
        category:    form.category,
        image_url:   form.image_url || null,
        available:   form.available,
      };

      let res;
      if (editing) {
        res = await fetch(`/api/admin/menuItems/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/admin/menuItems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }

      queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
      setShowForm(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    const res = await fetch(`/api/admin/menuItems/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error || `Error ${res.status}`);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
    queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
    setDeletingId(null);
  };

  const toggleAvailable = async (item) => {
    const res = await fetch(`/api/admin/menuItems/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ available: !item.available }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['admin-menu'] });
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      queryClient.invalidateQueries({ queryKey: ['admin-menu-items'] });
    }
  };

  // Group items by category
  const sorted  = [...items].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const grouped  = CATEGORIES
    .map(cat => ({ ...cat, items: sorted.filter(i => i.category === cat.value) }))
    .filter(g => g.items.length > 0);

  return (
    <div>
      {/* ── Tab bar ── */}
      <div className="flex gap-1 mb-5 bg-muted/50 rounded-xl p-1">
        {[
          { key: 'productos', label: '🍕 Productos' },
          { key: 'toppings',  label: '🧀 Toppings'  },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-sm font-medium py-2 rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Toppings tab ── */}
      {tab === 'toppings' && <ToppingsPanel />}

      {/* ── Productos tab ── */}
      {tab === 'productos' && <div>
      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="gap-2 rounded-xl bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4" /> Añadir producto
        </Button>
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">

              {/* Name */}
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">Nombre *</Label>
                <Input value={form.name} onChange={e => update('name', e.target.value)} required className="rounded-xl" />
              </div>

              {/* Description */}
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">Descripción / ingredientes</Label>
                <Input value={form.description} onChange={e => update('description', e.target.value)} placeholder="Ej: Tomate, mozzarella, albahaca…" className="rounded-xl" />
              </div>

              {/* Prices */}
              <div>
                <Label className="mb-1 block text-xs">Precio 33 cm (€) *</Label>
                <Input type="number" step="0.01" min="0" value={form.price} onChange={e => update('price', e.target.value)} required className="rounded-xl" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Precio 23 cm (€)</Label>
                <Input type="number" step="0.01" min="0" placeholder="Solo pizzas" value={form.price_23cm} onChange={e => update('price_23cm', e.target.value)} className="rounded-xl" />
              </div>

              {/* Category */}
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">Categoría *</Label>
                <Select value={form.category} onValueChange={val => update('category', val)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Image upload */}
              <div className="col-span-2">
                <Label className="mb-1 block text-xs">Foto del producto</Label>
                {form.image_url && (
                  <div className="relative mb-2">
                    <img
                      src={form.image_url}
                      alt="preview"
                      className="w-full h-40 object-cover rounded-xl"
                      onError={e => e.target.style.display = 'none'}
                    />
                    <button
                      type="button"
                      onClick={() => update('image_url', '')}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handleImageFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-border rounded-xl py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {uploading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
                    : <><Upload className="w-4 h-4" /> {form.image_url ? 'Cambiar imagen' : 'Subir imagen desde el dispositivo'}</>
                  }
                </button>
                {/* Also allow manual URL entry */}
                <Input
                  value={form.image_url}
                  onChange={e => update('image_url', e.target.value)}
                  placeholder="O pega una URL de imagen…"
                  className="rounded-xl mt-2 text-xs"
                />
              </div>

              {/* Available toggle */}
              <div className="col-span-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => update('available', !form.available)}
                  className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${form.available ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
                >
                  <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transform transition-transform ${form.available ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <Label className="text-xs">{form.available ? 'Disponible' : 'No disponible (agotado)'}</Label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={saving || uploading} className="flex-1 rounded-xl bg-primary hover:bg-primary/90">
                {saving ? 'Guardando…' : <><Check className="w-4 h-4 mr-1" /> Guardar</>}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {/* ── Item list ── */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-muted rounded-xl h-16 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="bg-muted/40 rounded-2xl p-8 text-center text-muted-foreground">
          No hay productos. Pulsa "Añadir producto" para empezar.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.value}>
              <h3 className="font-heading font-semibold text-sm text-muted-foreground mb-2">{group.label}</h3>
              <div className="space-y-2">
                {group.items.map(item => (
                  <div
                    key={item.id}
                    className={`bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3 transition-opacity ${!item.available ? 'opacity-50' : ''}`}
                  >
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center text-2xl">
                        {group.value === 'bebidas' ? '🥤' : group.value === 'cocteles' ? '🍹' : group.value === 'pizzas_dulces' ? '🍫' : '🍕'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {Number(item.price).toFixed(2)} €
                        {item.price_23cm ? ` · ${Number(item.price_23cm).toFixed(2)} € (23 cm)` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => toggleAvailable(item)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                        title={item.available ? 'Deshabilitar' : 'Habilitar'}
                      >
                        {item.available
                          ? <Eye className="w-4 h-4 text-green-600" />
                          : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </button>
                      {deletingId === item.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg bg-red-100 hover:bg-red-200 transition-colors"
                          >
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
      </div>}
    </div>
  );
}
