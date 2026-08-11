import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { loadPrintConfig } from './PrintConfig';

const PAYMENT_LABELS = {
  tarjeta: 'TARJETA / ONLINE',
  efectivo: 'EFECTIVO',
  bizum: 'BIZUM',
  apple_pay: 'APPLE PAY',
  google_pay: 'GOOGLE PAY',
};

function getTicketCSS(widthMm = 80) {
  return `
* { margin: 0; padding: 0; box-sizing: border-box; }

@page {
  size: ${widthMm}mm auto;
  margin: 0;
}

html {
  width: ${widthMm}mm;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Courier New', Courier, monospace;
  font-size: ${widthMm === 58 ? '10px' : '12px'};
  line-height: 1.35;
  width: ${widthMm}mm;
  max-width: ${widthMm}mm;
  margin: 0;
  padding: 2mm 3mm 14mm 3mm;
  color: #000 !important;
  background: #fff !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Eliminar cabecera/pie del navegador */
@page { margin: 0 !important; }

/* Sin saltos de página */
*, *::before, *::after {
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Clases de layout */
.c  { text-align: center; }
.r  { text-align: right; }
.b  { font-weight: bold; }
.s  { font-size: ${widthMm === 58 ? '9px' : '10px'}; }
.t  { font-size: 9px; }
.xl { font-size: ${widthMm === 58 ? '13px' : '15px'}; font-weight: bold; }

.dash   { border-top: 1px dashed #000; margin: 3px 0; }
.solid  { border-top: 2px solid #000;  margin: 3px 0; }
.double { border-top: 3px double #000; margin: 4px 0; }

.row        { display: flex; justify-content: space-between; align-items: flex-start; gap: 3px; }
.row .name  { flex: 1; word-break: break-word; }
.row .price { white-space: nowrap; font-weight: bold; }

.lbl { font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em; color: #333; }

.removed::before { content: "- SIN "; font-weight: bold; }
.removed { font-size: 9px; font-weight: bold; text-transform: uppercase; padding-left: 10px; }

.total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: ${widthMm === 58 ? '13px' : '15px'}; margin: 3px 0; }

.badge { display: inline-block; border: 1px solid #000; padding: 1px 5px; font-weight: bold; font-size: 10px; margin-top: 2px; }

.footer { text-align: center; font-size: 9px; margin-top: 8px; line-height: 1.7; }

@media print {
  .no-print { display: none !important; }
}
`;
}

export function buildTicketHTML(order, widthMm = 80) {
  const dateStr = new Date(order.created_at || order.created_date).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const orderId = (order.id?.slice(-6) || '??????').toUpperCase();
  const paymentLabel = PAYMENT_LABELS[order.payment_method] || (order.payment_method || '').toUpperCase();
  const isDelivery = order.order_type !== 'pickup';

  const SABOR_LABELS = { 1: '1 SABOR', 2: '2 SABORES', 3: '3 SABORES', 4: '4 SABORES (CUARTOS)' };

  const itemsHTML = (order.items || []).map(item => {
    const flavors = item.flavors || [];
    const extras  = item.extras  || [];

    let detailHTML = '';

    if (flavors.length > 0) {
      const saborLabel = SABOR_LABELS[flavors.length] || `${flavors.length} SABORES`;
      detailHTML += `<div class="s b" style="margin-left:8px;margin-top:2px;letter-spacing:0.04em;">${saborLabel}</div>`;
      flavors.forEach(f => {
        detailHTML += `<div class="s b" style="margin-left:12px;">&#8627; ${(f.name || '').replace(/^Pizza /i, '')}</div>`;
        (f.toppings || []).forEach(t => {
          detailHTML += `<div class="s" style="margin-left:20px;">+ ${t.name}${t.price ? ` <span style="color:#555">${parseFloat(t.price).toFixed(2)}E</span>` : ''}</div>`;
        });
        (f.removed || []).forEach(r => {
          detailHTML += `<div class="removed" style="margin-left:20px;">${r}</div>`;
        });
      });
    } else {
      // Non-pizza: old-style removed_ingredients
      (item.removed_ingredients || []).forEach(r => {
        detailHTML += `<div class="removed">${r}</div>`;
      });
    }

    if (extras.length > 0) {
      detailHTML += `<div class="s b" style="margin-left:8px;margin-top:2px;">EXTRAS:</div>`;
      extras.forEach(e => {
        detailHTML += `<div class="s" style="margin-left:14px;">+ ${e.name}${e.price ? ` <span style="color:#555">${parseFloat(e.price).toFixed(2)}E</span>` : ''}</div>`;
      });
    }

    return `
      <div style="margin-bottom:5px;">
        <div class="row">
          <span class="name b">${item.quantity}x ${item.name}</span>
          <span class="price">${(item.price * item.quantity).toFixed(2)}E</span>
        </div>
        ${detailHTML}
      </div>`;
  }).join('');

  const deliveryFeeHTML = order.delivery_fee > 0
    ? `<div class="row s"><span>Envio a domicilio</span><span>${order.delivery_fee.toFixed(2)}E</span></div>` : '';
  const tipHTML = order.tip > 0
    ? `<div class="row s"><span>Propina</span><span>+${order.tip.toFixed(2)}E</span></div>` : '';

  return `
    <div class="c" style="margin-bottom:5px;">
      <div class="xl">MOZZARELLA Y FUEGO</div>
      <div class="s">Pizzeria Brasilena · Barcelona</div>
      <div class="s">Tel: 93 XXX XX XX</div>
    </div>

    <div class="dash"></div>

    <div class="c" style="margin-bottom:4px;">
      <div class="b" style="font-size:14px;">PEDIDO #${orderId}</div>
      <div class="s">${dateStr}</div>
      <span class="badge">${isDelivery ? '★ DOMICILIO' : '★ RECOGIDA LOCAL'}</span>
    </div>

    <div class="dash"></div>

    <div style="margin-bottom:4px;">
      <div class="lbl">Cliente</div>
      <div class="b">${order.customer_name || '-'}</div>
      <div class="b s">Tel: ${order.customer_phone || '-'}</div>
      ${isDelivery && order.customer_address ? `<div class="b s">${order.customer_address}</div>` : ''}
      ${!isDelivery && order.pickup_time ? `<div class="b s">Recogida: ${order.pickup_time}</div>` : ''}
    </div>

    ${order.customer_notes ? `
      <div style="margin-bottom:4px;border:1px dashed #000;padding:2px 4px;">
        <div class="lbl">Obs / Alergias</div>
        <div class="b s">${order.customer_notes}</div>
      </div>` : ''}

    <div class="dash"></div>

    <div style="margin-bottom:4px;">
      <div class="lbl" style="margin-bottom:2px;">Articulos</div>
      ${itemsHTML}
    </div>

    <div class="solid"></div>

    ${deliveryFeeHTML}
    ${tipHTML}

    <div class="double"></div>

    <div class="total-row">
      <span>TOTAL</span>
      <span>${order.total?.toFixed(2)} EUR</span>
    </div>

    <div class="dash"></div>

    <div style="margin-bottom:4px;">
      <div class="lbl">Metodo de pago</div>
      <div class="b" style="font-size:13px;">${paymentLabel}</div>
    </div>

    <div class="dash"></div>

    <div class="footer">
      &iexcl;Gracias por tu pedido!<br/>
      <span class="t">${dateStr} · #${orderId}</span>
    </div>
  `;
}

export function printTicket(order) {
  const cfg = loadPrintConfig();
  const widthMm = cfg.printer_id === 'generic-58' ? 58 : 80;

  const html    = buildTicketHTML(order, widthMm);
  const css     = getTicketCSS(widthMm);
  const orderId = (order.id?.slice(-6) || '??????').toUpperCase();

  const pw = window.open('', '_blank', 'width=340,height=640,menubar=no,toolbar=no,scrollbars=yes,status=no');
  if (!pw) {
    alert('Permite las ventanas emergentes para esta página e inténtalo de nuevo.');
    return false;
  }

  pw.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Ticket #${orderId}</title>
  <style>${css}</style>
</head>
<body>${html}</body>
</html>`);
  pw.document.close();
  pw.focus();

  const isAndroid = /android/i.test(navigator.userAgent);
  setTimeout(() => {
    pw.print();
    if (!isAndroid) setTimeout(() => pw.close(), 1000);
  }, isAndroid ? 800 : 300);

  return true;
}

// ─── Componente visual ────────────────────────────────────────────────────────
export default function OrderTicket({ order, onClose }) {
  const cfg     = loadPrintConfig();
  const widthMm = cfg.printer_id === 'generic-58' ? 58 : 80;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Barra superior */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <p className="font-semibold text-sm text-gray-700">
            Ticket #{(order.id?.slice(-6) || '??????').toUpperCase()}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => printTicket(order)}
              className="gap-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Vista previa */}
        <div className="overflow-auto max-h-[70vh] p-4 bg-gray-100">
          <div
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: widthMm === 58 ? '10px' : '11px',
              lineHeight: '1.35',
              width: `${widthMm - 8}mm`,
              margin: '0 auto',
              background: '#fff',
              padding: '3mm 4mm 8mm',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              color: '#000',
            }}
            dangerouslySetInnerHTML={{ __html: buildTicketHTML(order, widthMm) }}
          />
        </div>

        {/* Pie informativo */}
        <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
          <p className="text-xs text-blue-700 text-center">
            Impresora: <strong>{cfg.printer_id || 'premier-itp85'}</strong> · {widthMm}mm
            <br/>
            <span className="text-blue-500">Papel: {widthMm}mm × auto · Márgenes: Ninguno</span>
          </p>
        </div>
      </div>
    </div>
  );
}