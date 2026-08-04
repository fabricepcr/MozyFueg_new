import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const ADMIN_PASSWORD = 'mozzarellayfuego123';

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const defaultSchedule = () =>
  Object.fromEntries(DAYS.map(d => [d.key, { enabled: false, slots: [{ open: '19:00', close: '23:00' }] }]));

async function callAdminSettings(action, data) {
  const res = await base44.functions.invoke('adminSettings', { action, password: ADMIN_PASSWORD, data });
  if (res.data?.error) throw new Error(res.data.error);
  return res.data?.data;
}

export default function AdminDeliverySettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    callAdminSettings('getDeliverySettings')
      .then((data) => {
        if (data) {
          setSettings({ mode: data.mode || 'manual', manual_active: data.manual_active !== false, schedule: data.schedule || defaultSchedule() });
        } else {
          setSettings({ mode: 'manual', manual_active: true, schedule: defaultSchedule() });
        }
      })
      .catch(() => {
        setSettings({ mode: 'manual', manual_active: true, schedule: defaultSchedule() });
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await callAdminSettings('updateDeliverySettings', {
        mode: settings.mode,
        manual_active: settings.manual_active,
        schedule: settings.schedule,
      });
      toast({ title: 'Configuración guardada', duration: 4000 });
    } catch {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field, value) => setSettings(prev => ({ ...prev, [field]: value }));

  const updateDay = (day, field, value) =>
    setSettings(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [day]: { ...prev.schedule?.[day], [field]: value } },
    }));

  const updateSlot = (day, idx, field, value) => {
    const slots = [...(settings.schedule?.[day]?.slots || [])];
    slots[idx] = { ...slots[idx], [field]: value };
    updateDay(day, 'slots', slots);
  };

  const addSlot = (day) => {
    const slots = [...(settings.schedule?.[day]?.slots || []), { open: '12:00', close: '16:00' }];
    updateDay(day, 'slots', slots);
  };

  const removeSlot = (day, idx) => {
    const slots = (settings.schedule?.[day]?.slots || []).filter((_, i) => i !== idx);
    updateDay(day, 'slots', slots);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <h3 className="font-heading font-semibold mb-4">Modo de control</h3>
        <div className="grid grid-cols-2 gap-3">
          {['manual', 'schedule'].map(mode => (
            <button
              key={mode}
              onClick={() => updateField('mode', mode)}
              className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${settings.mode === mode ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}
            >
              {mode === 'manual' ? '🔘 Manual' : '🗓️ Por horario'}
            </button>
          ))}
        </div>
      </div>

      {settings.mode === 'manual' && (
        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base font-semibold">Delivery activo</Label>
              <p className="text-sm text-muted-foreground mt-0.5">Activa o desactiva el delivery manualmente</p>
            </div>
            <Switch checked={settings.manual_active !== false} onCheckedChange={val => updateField('manual_active', val)} />
          </div>
          <div className={`mt-3 text-sm font-medium px-3 py-2 rounded-lg inline-block ${settings.manual_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {settings.manual_active !== false ? '✓ Delivery disponible' : '✗ Delivery no disponible'}
          </div>
        </div>
      )}

      {settings.mode === 'schedule' && (
        <div className="bg-card rounded-2xl border border-border/50 p-5 space-y-4">
          <h3 className="font-heading font-semibold">Horarios por día</h3>
          {DAYS.map(({ key, label }) => {
            const day = settings.schedule?.[key] || { enabled: false, slots: [] };
            return (
              <div key={key} className={`border rounded-xl p-4 transition-colors ${day.enabled ? 'border-primary/30 bg-primary/3' : 'border-border bg-muted/20'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">{label}</span>
                  <Switch checked={!!day.enabled} onCheckedChange={val => updateDay(key, 'enabled', val)} />
                </div>
                {day.enabled && (
                  <div className="space-y-2">
                    {(day.slots || []).map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="time" value={slot.open} onChange={e => updateSlot(key, idx, 'open', e.target.value)} className="border border-input rounded-lg px-2 py-1.5 text-sm bg-background" />
                        <span className="text-muted-foreground text-sm">–</span>
                        <input type="time" value={slot.close} onChange={e => updateSlot(key, idx, 'close', e.target.value)} className="border border-input rounded-lg px-2 py-1.5 text-sm bg-background" />
                        {(day.slots || []).length > 1 && (
                          <button onClick={() => removeSlot(key, idx)} className="text-destructive hover:text-destructive/70">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addSlot(key)} className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline">
                      <Plus className="w-3 h-3" /> Añadir franja
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button onClick={save} disabled={saving} className="w-full rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Guardando...</> : 'Guardar configuración'}
      </Button>
    </div>
  );
}