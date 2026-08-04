import React, { useState, useEffect } from 'react';
import { Printer, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

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

export default function PrintConfig() {
  const [config, setConfig] = useState(() => ({
    printer_id: 'premier-itp85',
    auto_print: false,
    ...loadPrintConfig(),
  }));

  useEffect(() => { savePrintConfig(config); }, [config]);

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const selectedPrinter = PRINTER_MODELS.find(p => p.id === config.printer_id) || PRINTER_MODELS[0];

  return (
    <div className="space-y-6">

      {/* Selección de impresora */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <h3 className="font-heading font-semibold mb-4 flex items-center gap-2">
          <Printer className="w-4 h-4" /> Impresora predeterminada
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

      {/* Auto Print */}
      <div className="bg-card rounded-2xl border border-border/50 p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-sm">AUTO PRINT</span>
          </div>
          <Switch
            checked={config.auto_print}
            onCheckedChange={v => update('auto_print', v)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Cuando está activado, los tickets se imprimen automáticamente al recibir un pedido nuevo sin intervención del usuario.
        </p>
        {config.auto_print && (
          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs text-amber-800 font-semibold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Requisito: Chrome debe tener permiso para abrir ventanas emergentes en este sitio.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}