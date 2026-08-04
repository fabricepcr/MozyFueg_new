import React, { useState, useEffect } from 'react';
import { Loader2, Truck, Package, Store, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

const ADMIN_PASSWORD = 'mozzarellayfuego123';

async function getSettings() {
  const res = await fetch('/api/adminSettings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get' }),
  });
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return data;
}

async function saveSettings(settings) {
  const res = await fetch('/api/adminSettings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', password: ADMIN_PASSWORD, settings }),
  });
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function StorePanel() {
  const [storeOpen, setStoreOpen] = useState(true);
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [pickupEnabled, setPickupEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    getSettings()
      .then(d => {
        setStoreOpen(d?.store_open !== false);
        setDeliveryEnabled(d?.delivery_enabled !== false);
        setPickupEnabled(d?.pickup_enabled !== false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSettings({
        store_open: storeOpen,
        delivery_enabled: deliveryEnabled,
        pickup_enabled: pickupEnabled,
      });
      toast({ title: '✅ Cambios guardados', description: 'Ya están activos en toda la web.', duration: 3000 });
    } catch (err) {
      toast({ title: 'Error al guardar', description: err.message, variant: 'destructive', duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mb-2">
        Activa o desactiva cada opción y pulsa <strong>Guardar</strong> para que los cambios se apliquen en toda la web.
      </p>

      <ToggleRow
        icon={Store}
        label="Tienda"
        descOn="Aceptando pedidos"
        descOff="Tienda cerrada — no se aceptan pedidos"
        checked={storeOpen}
        onChange={setStoreOpen}
      />
      <ToggleRow
        icon={Truck}
        label="Delivery"
        descOn="Reparto a domicilio activo"
        descOff="Sin reparto a domicilio"
        checked={deliveryEnabled}
        onChange={setDeliveryEnabled}
      />
      <ToggleRow
        icon={Package}
        label="Recogida en local"
        descOn="Pueden recoger en el local"
        descOff="Sin recogida en este momento"
        checked={pickupEnabled}
        onChange={setPickupEnabled}
      />

      {storeOpen && !deliveryEnabled && !pickupEnabled && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          ⚠️ La tienda está abierta pero sin ningún método de pedido activo. Los clientes no podrán finalizar pedidos.
        </div>
      )}

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full mt-2 gap-2 rounded-xl py-5 text-base"
      >
        {saving
          ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</>
          : <><Save className="w-4 h-4" />Guardar cambios</>
        }
      </Button>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, descOn, descOff, checked, onChange }) {
  return (
    <div className={`rounded-2xl border-2 p-5 transition-all ${checked ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${checked ? 'bg-green-100' : 'bg-red-100'}`}>
            <Icon className={`w-5 h-5 ${checked ? 'text-green-700' : 'text-red-700'}`} />
          </div>
          <div>
            <p className={`font-semibold text-base ${checked ? 'text-green-800' : 'text-red-800'}`}>
              {label} — {checked ? 'Activado' : 'Desactivado'}
            </p>
            <p className={`text-xs mt-0.5 ${checked ? 'text-green-600' : 'text-red-600'}`}>
              {checked ? descOn : descOff}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`relative inline-flex items-center w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${checked ? 'bg-green-500' : 'bg-red-400'}`}
        >
          <span className={`inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${checked ? 'translate-x-8' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  );
}
