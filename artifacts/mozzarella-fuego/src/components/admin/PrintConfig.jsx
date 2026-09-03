import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle, AlertTriangle, Zap, Wifi, Usb, X, Loader2, MessageCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { printTicket } from './OrderTicket';
import { printViaUSB } from '@/lib/escpos';
import { useToast } from '@/components/ui/use-toast';

const PRINTER_MODELS = [
  { id: 'premier-itp85', label: 'Premier ITP-85 (80mm)', width: 80 },
  { id: 'epson-tmt20',   label: 'Epson TM-T20 (80mm)',   width: 80 },
  { id: 'epson-tmt88',   label: 'Epson TM-T88 (80mm)',   width: 80 },
  { id: 'generic-80',    label: 'Genérica ESC/POS 80mm', width: 80 },
  { id: 'generic-58',    label: 'Genérica ESC/POS 58mm', width: 58 },
];

export function loadPrintConfig() {
  try {
    return JSON.parse(localStorage.getItem('print_config') || '{}');
  } catch { return {}; }
}

export function savePrintConfig(cfg) {
  localStorage.setItem('print_config', JSON.stringify(cfg));
}

const DEMO_ORDER = {
  id: 'demo-000000',
  created_at: new Date().toISOString(),
  customer_name: 'Cliente Prueba',
  customer_phone: '600000000',
  customer_address: 'Calle Mayor 1, Barcelona',
  order_type: 'delivery',
  items: [{ name: 'Pizza Margarita', quantity: 2, price: 12.5 }],
  total: 25,
  subtotal: 21,
  delivery_fee: 4,
  tip: 0,
  payment_method: 'efectivo',
};

export default function PrintConfig() {
  const { toast } = useToast();
  const [config, setConfig] = useState(() => ({
    printer_id: 'premier-itp85',
    print_mode: 'none',   // 'network' | 'usb' | 'none'
    auto_print: false,
    network_ip: '',
    network_port: '9100',
    ...loadPrintConfig(),
  }));
  const [testing, setTesting] = useState(false);
  const [testingWa, setTestingWa] = useState(false);

  useEffect(() => { savePrintConfig(config); }, [config]);

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const selectedPrinter = PRINTER_MODELS.find(p => p.id === config.printer_id) || PRINTER_MODELS[0];

  const handleTestPrint = async () => {
    setTesting(true);
    try {
      const result = await triggerPrint(DEMO_ORDER, config);
      if (result.ok) {
        toast({ title: '✅ Prueba enviada', description: result.message || 'Ticket de prueba en camino.', duration: 3000 });
      } else {
        toast({ title: '⚠️ Error de impresión', description: result.error, variant: 'destructive', duration: 5000 });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">

      {/* ── Printer model ──────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <h3 className="font-heading font-semibold mb-4 flex items-center gap-2">
          <Printer className="w-4 h-4" /> Modelo de impresora
        </h3>
        <div className="space-y-2">
          {PRINTER_MODELS.map(p => (
            <button
              key={p.id}
              onClick={() => update('printer_id', p.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                config.printer_id === p.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-background hover:border-primary/40'
              }`}
            >
              <Printer className={`w-4 h-4 ${config.printer_id === p.id ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${config.printer_id === p.id ? 'text-primary' : 'text-foreground'}`}>
                {p.label}
              </span>
              {config.printer_id === p.id && <CheckCircle className="w-4 h-4 text-primary ml-auto" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Print mode ─────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <h3 className="font-heading font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" /> Modo de impresión
        </h3>
        <div className="space-y-2 mb-4">
          {[
            { id: 'network', icon: Wifi,    label: 'Red (TCP/IP)',  desc: 'El servidor envía el ticket directamente a la impresora por red' },
            { id: 'usb',     icon: Usb,     label: 'USB / Serie',  desc: 'El navegador envía bytes ESC/POS por puerto serie (Chrome en PC/Mac)' },
            { id: 'none',    icon: Printer, label: 'Ventana de impresión', desc: 'Abre el diálogo de impresión del navegador (fallback)' },
          ].map(m => {
            const MIcon = m.icon;
            const active = config.print_mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => update('print_mode', m.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                  active ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/40'
                }`}
              >
                <MIcon className={`w-4 h-4 mt-0.5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${active ? 'text-primary' : 'text-foreground'}`}>{m.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
                {active && <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Network fields */}
        {config.print_mode === 'network' && (
          <div className="border-t pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conexión de red</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">IP de la impresora</label>
                <Input
                  value={config.network_ip}
                  onChange={e => update('network_ip', e.target.value)}
                  placeholder="192.168.1.100"
                  className="rounded-xl text-sm"
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Puerto</label>
                <Input
                  value={config.network_port}
                  onChange={e => update('network_port', e.target.value)}
                  placeholder="9100"
                  className="rounded-xl text-sm"
                />
              </div>
            </div>
            {!config.network_ip && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                Introduce la IP de la impresora. La encontrarás en su pantalla o imprimiendo un ticket de configuración.
              </p>
            )}
          </div>
        )}

        {/* USB note */}
        {config.print_mode === 'usb' && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Al imprimir, el navegador intenta detectar la impresora por <strong>WebUSB</strong> (Mac/Linux) y, si no la encuentra, por <strong>puerto COM</strong> (Serie/USB-serie). La primera vez tendrás que seleccionarla del selector; después la recuerda.
                <br className="mb-1" />
                <strong>Windows:</strong> si no aparece en el selector, el driver de Windows bloquea el acceso directo. Soluciones: instalar el driver <strong>WinUSB</strong> con <em>Zadig</em>, activar el modo COM en la impresora, o cambiar a modo <strong>Red (TCP/IP)</strong> que es la opción más fiable.
              </span>
            </p>
          </div>
        )}
      </div>

      {/* ── Auto Print toggle ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-sm">AUTO PRINT al confirmar</span>
          </div>
          <Switch
            checked={config.auto_print}
            onCheckedChange={v => update('auto_print', v)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Cuando está activado, el ticket se imprime automáticamente al cambiar el estado a "Confirmado".
        </p>
        {config.auto_print && config.print_mode === 'none' && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Chrome debe tener permiso para abrir ventanas emergentes en este sitio.
            </p>
          </div>
        )}
      </div>

      {/* ── WhatsApp (green-api) ───────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-sm">WhatsApp a repartidores</span>
          </div>
          <span className="text-[11px] font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-1">
            Automático
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Al confirmar cualquier pedido a domicilio, el servidor envía automáticamente los detalles por WhatsApp a todos los repartidores activos. Los pedidos para recoger no generan mensajes.
        </p>
        <div className="bg-muted/40 rounded-xl p-3 space-y-2 text-xs">
          <p className="font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Credenciales requeridas (secrets del servidor)</p>
          <div className="flex items-center justify-between">
            <code className="bg-background border border-border rounded px-1.5 py-0.5 text-[11px]">GREEN_API_INSTANCE_ID</code>
            <span className="text-muted-foreground">ID de instancia de green-api.com</span>
          </div>
          <div className="flex items-center justify-between">
            <code className="bg-background border border-border rounded px-1.5 py-0.5 text-[11px]">GREEN_API_TOKEN</code>
            <span className="text-muted-foreground">Token de acceso de la instancia</span>
          </div>
          <p className="text-muted-foreground">
            Crea una cuenta en <strong>green-api.com</strong>, activa una instancia de WhatsApp y pega las credenciales en los secrets del servidor.
          </p>
        </div>
      </div>

      {/* ── Test print button ──────────────────────────────────────────────── */}
      <Button
        onClick={handleTestPrint}
        disabled={testing}
        variant="outline"
        className="w-full gap-2 rounded-xl py-5 border-2"
      >
        {testing
          ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando prueba...</>
          : <><Printer className="w-4 h-4" />Imprimir ticket de prueba</>
        }
      </Button>

    </div>
  );
}

/**
 * Shared print trigger — called from PrintConfig test and AdminOrders auto-print.
 * Returns { ok, message?, error? }
 */
export async function triggerPrint(order, cfg) {
  const mode = cfg?.print_mode || 'none';
  const widthMm = (PRINTER_MODELS.find(p => p.id === cfg?.printer_id) || PRINTER_MODELS[0]).width;

  // ── Network mode ─────────────────────────────────────────────────────────
  if (mode === 'network') {
    const ip   = cfg.network_ip?.trim();
    const port = cfg.network_port?.trim() || '9100';
    if (!ip) {
      return { ok: false, error: 'Configura la IP de la impresora en Ajustes → Impresora.' };
    }
    try {
      const res = await fetch('/api/admin/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order, ip, port }),
      });
      const data = await res.json();
      if (!res.ok || data.error) return { ok: false, error: data.error || 'Error de red al imprimir' };
      return { ok: true, message: `Ticket enviado a ${ip}:${port}` };
    } catch (err) {
      return { ok: false, error: err?.message || 'Error de conexión' };
    }
  }

  // ── USB / Serial mode ────────────────────────────────────────────────────
  if (mode === 'usb') {
    return printViaUSB(order, widthMm);
  }

  // ── Fallback: window.print ───────────────────────────────────────────────
  const { printTicket } = await import('./OrderTicket');
  const opened = printTicket(order);
  if (!opened) return { ok: false, error: 'Permite ventanas emergentes para imprimir.' };
  return { ok: true, message: 'Diálogo de impresión abierto.' };
}
