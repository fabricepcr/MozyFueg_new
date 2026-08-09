import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { UserPlus, Pencil, Check, X, Power, PowerOff, Phone, User, Trash2 } from 'lucide-react';

async function apiFetch(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const json = await res.json();
  if (json?.error) throw new Error(json.error);
  return json;
}

function DriverRow({ driver, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(driver.name);
  const [phone, setPhone] = useState(driver.phone);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/deliveryGuys/${driver.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name, phone }),
      });
      onUpdate();
      setEditing(false);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/deliveryGuys/${driver.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !driver.active }),
      });
      onUpdate();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/admin/deliveryGuys/${driver.id}`, { method: 'DELETE' });
      onUpdate();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  const handleCancel = () => {
    setName(driver.name);
    setPhone(driver.phone);
    setEditing(false);
  };

  if (confirmDelete) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-red-800">¿Eliminar a {driver.name}?</p>
        <p className="text-xs text-red-600">Se desasignará de cualquier pedido actual. Esta acción no se puede deshacer.</p>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white" onClick={handleDelete} disabled={saving}>
            {saving ? 'Eliminando…' : 'Sí, eliminar'}
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs rounded-lg" onClick={() => setConfirmDelete(false)}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1 block">Nombre</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del repartidor"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground font-medium mb-1 block">Teléfono</label>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
              type="tel"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 gap-1.5 text-xs rounded-lg" onClick={handleSave} disabled={saving || !name || !phone}>
            <Check className="w-3.5 h-3.5" /> Guardar
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs rounded-lg" onClick={handleCancel}>
            <X className="w-3.5 h-3.5" /> Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-xl p-4 flex items-center gap-3 ${driver.active ? 'border-border' : 'border-border/40 opacity-60'}`}>
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <User className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">{driver.name}</p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Phone className="w-3 h-3" /> {driver.phone}
        </p>
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${driver.active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'}`}>
        {driver.active ? 'Activo' : 'Inactivo'}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Editar"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={handleToggleActive}
        disabled={saving}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title={driver.active ? 'Desactivar' : 'Activar'}
      >
        {driver.active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        disabled={saving}
        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
        title="Eliminar"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function AddDriverForm({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      await apiFetch('/api/admin/deliveryGuys', {
        method: 'POST',
        body: JSON.stringify({ name, phone }),
      });
      setName('');
      setPhone('');
      setOpen(false);
      onAdd();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} className="w-full gap-2 rounded-xl" variant="outline">
        <UserPlus className="w-4 h-4" />
        Añadir repartidor
      </Button>
    );
  }

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold">Nuevo repartidor</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Nombre *</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Carlos"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground font-medium mb-1 block">Teléfono *</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            type="tel"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 gap-1.5 text-xs rounded-lg" onClick={handleSubmit} disabled={saving || !name.trim() || !phone.trim()}>
          <UserPlus className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Añadir'}
        </Button>
        <Button size="sm" variant="outline" className="flex-1 text-xs rounded-lg" onClick={() => { setOpen(false); setName(''); setPhone(''); }}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

export default function DeliveryGuysPanel() {
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ['delivery-guys'],
    queryFn: async () => {
      const json = await apiFetch('/api/admin/deliveryGuys');
      return json.data || [];
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['delivery-guys'] });

  const active = drivers.filter(d => d.active);
  const inactive = drivers.filter(d => !d.active);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-semibold text-lg mb-1">Repartidores</h2>
        <p className="text-sm text-muted-foreground">Gestiona el equipo de reparto. Los repartidores activos pueden ser asignados a pedidos de delivery.</p>
      </div>

      <AddDriverForm onAdd={refresh} />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : drivers.length === 0 ? (
        <div className="bg-muted/40 rounded-2xl p-8 text-center text-muted-foreground">
          <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aún no hay repartidores registrados</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Activos ({active.length})
              </p>
              <div className="space-y-2">
                {active.map(d => <DriverRow key={d.id} driver={d} onUpdate={refresh} />)}
              </div>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Inactivos ({inactive.length})
              </p>
              <div className="space-y-2">
                {inactive.map(d => <DriverRow key={d.id} driver={d} onUpdate={refresh} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
