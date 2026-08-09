/**
 * ESC/POS byte generator for browser-side USB/Serial printing.
 * Produces a Uint8Array of raw printer commands compatible with
 * thermal printers like the PREMIER ITP-85 at 80mm width.
 */

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;

function enc(text) {
  // Simple Latin-1 encoder (covers Spanish characters)
  const arr = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    arr.push(c <= 0xff ? c : 0x3f); // '?' fallback for chars outside Latin-1
  }
  return arr;
}

function pushLine(bytes, text = '') {
  bytes.push(...enc(text));
  bytes.push(LF);
}

function centered(text, width = 42) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(pad) + text;
}

const PAYMENT_LABELS = {
  efectivo: 'EFECTIVO',
  tarjeta:  'TARJETA',
  bizum:    'BIZUM',
  datafono: 'DATAFONO',
};

/**
 * Build raw ESC/POS byte array for an order.
 * @param {object} order
 * @param {number} [widthMm=80]
 * @returns {Uint8Array}
 */
export function buildEscPosBytes(order, widthMm = 80) {
  const W = widthMm === 58 ? 32 : 42;
  const bytes = [];

  const orderId = (order.id?.slice(-6) || '??????').toUpperCase();
  const dateStr = new Date(order.created_at || order.created_date).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
  const isDelivery = order.order_type !== 'pickup';

  // ── Initialize ───────────────────────────────────────────────────────────
  bytes.push(ESC, 0x40); // init

  // ── Header ───────────────────────────────────────────────────────────────
  bytes.push(ESC, 0x61, 0x01); // center
  bytes.push(GS, 0x21, 0x11);  // double width+height
  pushLine(bytes, 'MOZZARELLA Y FUEGO');
  bytes.push(GS, 0x21, 0x00);  // normal
  pushLine(bytes, 'Pizzeria - Barcelona');
  bytes.push(ESC, 0x61, 0x00); // left
  pushLine(bytes, '-'.repeat(W));

  // ── Order info ────────────────────────────────────────────────────────────
  bytes.push(ESC, 0x61, 0x01); // center
  bytes.push(ESC, 0x45, 0x01); // bold on
  pushLine(bytes, `PEDIDO #${orderId}`);
  bytes.push(ESC, 0x45, 0x00); // bold off
  pushLine(bytes, dateStr);
  pushLine(bytes, isDelivery ? '** DOMICILIO **' : '** RECOGIDA LOCAL **');
  bytes.push(ESC, 0x61, 0x00); // left
  pushLine(bytes, '-'.repeat(W));

  // ── Customer ─────────────────────────────────────────────────────────────
  bytes.push(ESC, 0x45, 0x01);
  pushLine(bytes, order.customer_name || '-');
  bytes.push(ESC, 0x45, 0x00);
  pushLine(bytes, `Tel: ${order.customer_phone || '-'}`);
  if (isDelivery && order.customer_address) {
    pushLine(bytes, order.customer_address);
  }
  if (!isDelivery && order.pickup_time) {
    pushLine(bytes, `Recogida: ${order.pickup_time}`);
  }
  if (order.customer_notes) {
    pushLine(bytes, '-'.repeat(W));
    pushLine(bytes, `Notas: ${order.customer_notes}`);
  }

  // ── Items ─────────────────────────────────────────────────────────────────
  pushLine(bytes, '-'.repeat(W));
  pushLine(bytes, 'ARTICULOS');
  pushLine(bytes, '-'.repeat(W));

  for (const item of order.items || []) {
    const name  = `${item.quantity}x ${item.name}`;
    const price = `${(item.price * item.quantity).toFixed(2)}E`;
    const gap   = W - name.length - price.length;
    if (gap > 0) {
      pushLine(bytes, name + ' '.repeat(gap) + price);
    } else {
      pushLine(bytes, name);
      pushLine(bytes, ' '.repeat(Math.max(0, W - price.length)) + price);
    }
    for (const r of item.removed_ingredients || []) {
      pushLine(bytes, `  - SIN ${r.toUpperCase()}`);
    }
    for (const e of item.extras || []) {
      pushLine(bytes, `  + ${e}`);
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  pushLine(bytes, '='.repeat(W));

  if (order.delivery_fee > 0) {
    const envio = `${order.delivery_fee.toFixed(2)} EUR`;
    pushLine(bytes, 'Envio:' + ' '.repeat(Math.max(1, W - 6 - envio.length)) + envio);
  }
  if (order.tip > 0) {
    const tip = `+${order.tip.toFixed(2)} EUR`;
    pushLine(bytes, 'Propina:' + ' '.repeat(Math.max(1, W - 8 - tip.length)) + tip);
  }

  bytes.push(ESC, 0x45, 0x01); // bold
  bytes.push(GS, 0x21, 0x10);  // double height
  const totalStr = `TOTAL: ${(order.total || 0).toFixed(2)} EUR`;
  pushLine(bytes, totalStr);
  bytes.push(GS, 0x21, 0x00);
  bytes.push(ESC, 0x45, 0x00);

  const payLabel = PAYMENT_LABELS[order.payment_method] || (order.payment_method || '-').toUpperCase();
  pushLine(bytes, `Pago: ${payLabel}`);

  // ── Footer ────────────────────────────────────────────────────────────────
  pushLine(bytes, '-'.repeat(W));
  bytes.push(ESC, 0x61, 0x01); // center
  pushLine(bytes, '');
  pushLine(bytes, 'Gracias por su pedido!');
  pushLine(bytes, '');
  pushLine(bytes, '');
  pushLine(bytes, '');

  // Full cut
  bytes.push(GS, 0x56, 0x00);

  return new Uint8Array(bytes);
}

/**
 * Print via Web Serial API (USB mode).
 * Returns { ok: true } or { ok: false, error: string }.
 */
export async function printViaUSB(order, widthMm = 80) {
  if (!('serial' in navigator)) {
    return { ok: false, error: 'Web Serial API no disponible (usa Chrome en PC/Mac)' };
  }
  try {
    // Try to find a previously-allowed port first
    let port;
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      port = ports[0];
    } else {
      // Requires user gesture — caller must ensure this is inside a click handler
      port = await navigator.serial.requestPort();
    }

    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    const data = buildEscPosBytes(order, widthMm);
    await writer.write(data);
    writer.releaseLock();
    await port.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
