import React, { useState } from 'react';
import { Share2, Eye, Copy, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PAYMENT_LABELS = {
  tarjeta: 'Tarjeta / Online',
  efectivo: 'Efectivo',
  bizum: 'Bizum',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

const STATUS_LABELS = {
  payment_pending: 'Pago pendiente',
  pending: 'Recibido',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  delivering: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

function pad(str, len) {
  const s = String(str);
  return s.length < len ? s + ' '.repeat(len - s.length) : s;
}

function rpad(str, len) {
  const s = String(str);
  return s.length < len ? ' '.repeat(len - s.length) + s : s;
}

export function generateTicketText(order) {
  const W = 42; // caracteres por línea para 80mm
  const SEP = '-'.repeat(W);
  const orderId = (order.id?.slice(-6) || '??????').toUpperCase();
  const dateStr = new Date(order.created_at || order.created_date).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const isDelivery = order.order_type !== 'pickup';
  const location = isDelivery
    ? (order.customer_address || '-')
    : 'Recogida en local';

  // Cabecera centrada
  const center = (text) => {
    const spaces = Math.max(0, Math.floor((W - text.length) / 2));
    return ' '.repeat(spaces) + text;
  };

  let lines = [];

  lines.push(center('MOZZARELLA Y FUEGO'));
  lines.push(center('Pizzeria - Barcelona'));
  lines.push(SEP);
  lines.push(`Pedido: #${orderId}`);
  lines.push(`Fecha:  ${dateStr}`);
  lines.push(`Tipo:   ${isDelivery ? 'DOMICILIO' : 'RECOGIDA LOCAL'}`);
  lines.push('');
  lines.push('Cliente:');
  lines.push(`  ${order.customer_name || '-'}`);
  lines.push(`Telefono: ${order.customer_phone || '-'}`);
  lines.push(`${isDelivery ? 'Direccion' : 'Recogida'}:`);
  lines.push(`  ${location}`);
  if (!isDelivery && order.pickup_time) {
    lines.push(`Hora recogida: ${order.pickup_time}`);
  }

  lines.push('');
  lines.push(SEP);
  lines.push('PRODUCTOS');
  lines.push(SEP);

  (order.items || []).forEach(item => {
    const name = `${item.quantity} x ${item.name}`;
    const price = `${(item.price * item.quantity).toFixed(2)}EUR`;
    const gap = W - name.length - price.length;
    if (gap > 0) {
      lines.push(name + ' '.repeat(gap) + price);
    } else {
      lines.push(name);
      lines.push(rpad(price, W));
    }
    (item.removed_ingredients || []).forEach(r => {
      lines.push(`  - SIN ${r.toUpperCase()}`);
    });
  });

  if (order.customer_notes) {
    lines.push('');
    lines.push('Notas:');
    // Partir notas largas en líneas de W chars
    const words = order.customer_notes.split(' ');
    let line = '  ';
    words.forEach(w => {
      if (line.length + w.length + 1 > W) {
        lines.push(line);
        line = '  ' + w;
      } else {
        line += (line === '  ' ? '' : ' ') + w;
      }
    });
    if (line.trim()) lines.push(line);
  }

  lines.push('');
  lines.push(SEP);

  const addRow = (label, value) => {
    const v = String(value);
    const gap = W - label.length - v.length;
    lines.push(gap > 0 ? label + ' '.repeat(gap) + v : label + ' ' + v);
  };

  addRow('Subtotal:', `${(order.subtotal ?? order.total ?? 0).toFixed(2)}EUR`);
  if (order.delivery_fee > 0) addRow('Envio:', `${order.delivery_fee.toFixed(2)}EUR`);
  if (order.tip > 0) addRow('Propina:', `+${order.tip.toFixed(2)}EUR`);
  addRow('TOTAL:', `${(order.total ?? 0).toFixed(2)}EUR`);
  addRow('Pago:', PAYMENT_LABELS[order.payment_method] || (order.payment_method || '-'));
  addRow('Estado:', STATUS_LABELS[order.status] || (order.status || '-'));

  lines.push(SEP);
  lines.push(center('Gracias por su pedido'));
  lines.push('');

  return lines.join('\n');
}

export async function shareTicketWithThermer(order) {
  const ticketText = generateTicketText(order);
  if (navigator.share) {
    await navigator.share({
      title: 'Ticket de pedido',
      text: ticketText,
    });
  } else {
    return ticketText; // caller will show modal
  }
}

// ─── Componente botones + modal ───────────────────────────────────────────────
export default function ThermerShare({ order }) {
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const ticketText = generateTicketText(order);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: 'Ticket de pedido', text: ticketText });
    } else {
      setPreview(true);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(ticketText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-1.5 text-xs bg-blue-600 text-white border border-blue-700 rounded-xl py-2 hover:bg-blue-700 transition-colors font-medium"
        >
          <Share2 className="w-3.5 h-3.5" />
          Compartir con Thermer
        </button>
        <button
          onClick={() => setPreview(true)}
          className="flex items-center justify-center gap-1.5 text-xs bg-gray-100 text-gray-800 border border-gray-300 rounded-xl py-2 hover:bg-gray-200 transition-colors font-medium"
        >
          <Eye className="w-3.5 h-3.5" />
          Vista previa
        </button>
      </div>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <span className="font-semibold text-sm text-gray-700">Vista previa del ticket</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleShare}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs"
                >
                  <Share2 className="w-3.5 h-3.5" /> Compartir con Thermer
                </Button>
                <button onClick={() => setPreview(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Ticket en texto plano */}
            <div className="overflow-auto max-h-[60vh] p-4 bg-gray-100">
              <pre
                style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '11px', lineHeight: '1.4', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                className="bg-white p-3 rounded-lg shadow-inner text-black"
              >
                {ticketText}
              </pre>
            </div>

            {/* Footer copiar */}
            <div className="px-4 py-3 border-t bg-gray-50 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs rounded-lg"
                onClick={handleCopy}
              >
                {copied
                  ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /> ¡Copiado!</>
                  : <><Copy className="w-3.5 h-3.5" /> Copiar ticket</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}