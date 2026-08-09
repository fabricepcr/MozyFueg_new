import React, { useState, useEffect, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Loader2, Store, AlertCircle, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
async function callAdmin(body) {
  const res = await fetch('/api/adminSettings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data;
}

export default function StoreToggle() {
  const [storeOpen, setStoreOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const { toast } = useToast();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await callAdmin({ action: 'getPublicSettings' });
      setStoreOpen(d?.storeOpen !== false);
    } catch {
      setError('No se pudo cargar el estado de la tienda.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const toggle = async (val) => {
    if (saving) return;
    setSaving(true);
    try {
      await callAdmin({ action: 'updateSetting', key: 'store_open', value: val });
      setStoreOpen(val);
      toast({
        title: val ? '✅ Tienda abierta' : '🔴 Tienda cerrada',
        description: val ? 'Los clientes pueden hacer pedidos.' : 'Se ha bloqueado la recepción de nuevos pedidos.',
        duration: 4000,
      });
    } catch {
      toast({ title: 'Error al guardar', description: 'No se pudo guardar el estado. Inténtalo de nuevo.', variant: 'destructive', duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5">
        <p className="text-red-700 text-sm font-medium mb-2">{error}</p>
        <button onClick={loadSettings} className="flex items-center gap-1.5 text-xs text-red-600 hover:underline">
          <RefreshCw className="w-3.5 h-3.5" /> Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all ${storeOpen ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${storeOpen ? 'bg-green-100' : 'bg-red-100'}`}>
            {storeOpen ? <Store className="w-5 h-5 text-green-700" /> : <AlertCircle className="w-5 h-5 text-red-700" />}
          </div>
          <div>
            <p className={`font-heading font-bold text-base ${storeOpen ? 'text-green-800' : 'text-red-800'}`}>
              {storeOpen ? 'Tienda abierta' : 'Tienda cerrada'}
            </p>
            <p className={`text-xs mt-0.5 ${storeOpen ? 'text-green-600' : 'text-red-600'}`}>
              {storeOpen ? 'Aceptando pedidos online' : 'No se aceptan pedidos online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          <Switch checked={storeOpen} onCheckedChange={toggle} disabled={saving || loading} />
        </div>
      </div>
    </div>
  );
}