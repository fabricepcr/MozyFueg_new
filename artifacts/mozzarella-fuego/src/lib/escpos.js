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
  // Re-assert bold + double-strike immediately before every line.
  // Some printers (e.g. Premier ITP-85) silently clear these attributes
  // on GS ! size changes, alignment changes, or even between lines.
  bytes.push(0x1b, 0x45, 0x01); // ESC E 1 — emphasize / bold ON
  bytes.push(0x1b, 0x47, 0x01); // ESC G 1 — double-strike ON
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
  bytes.push(ESC, 0x40);       // init
  bytes.push(ESC, 0x45, 0x01); // bold ON — globally for whole ticket
  bytes.push(ESC, 0x47, 0x01); // double-strike ON — prints each dot twice (darker ink)

  // Helper: re-apply darkness after any GS ! size reset (some printers clear attributes)
  const reDark = () => { bytes.push(ESC, 0x45, 0x01); bytes.push(ESC, 0x47, 0x01); };

  // ── Header ───────────────────────────────────────────────────────────────
  bytes.push(ESC, 0x61, 0x01); // center
  bytes.push(GS, 0x21, 0x11);  // double width+height
  pushLine(bytes, 'MOZZARELLA Y FUEGO');
  bytes.push(GS, 0x21, 0x00);  // normal size
  reDark();                     // restore bold+double-strike after size reset
  pushLine(bytes, 'Pizzeria - Barcelona');
  bytes.push(ESC, 0x61, 0x00); // left
  pushLine(bytes, '-'.repeat(W));

  // ── Order info ────────────────────────────────────────────────────────────
  bytes.push(ESC, 0x61, 0x01); // center
  pushLine(bytes, `PEDIDO #${orderId}`);

  pushLine(bytes, dateStr);
  pushLine(bytes, isDelivery ? '** DOMICILIO **' : '** RECOGIDA LOCAL **');
  bytes.push(ESC, 0x61, 0x00); // left
  pushLine(bytes, '-'.repeat(W));

  // ── Customer ─────────────────────────────────────────────────────────────
  pushLine(bytes, order.customer_name || '-');
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

  bytes.push(GS, 0x21, 0x10);  // double height for total
  const totalStr = `TOTAL: ${(order.total || 0).toFixed(2)} EUR`;
  pushLine(bytes, totalStr);
  bytes.push(GS, 0x21, 0x00);
  reDark();                     // restore bold+double-strike after size reset

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

// ── WebUSB path (USB printer class devices) ───────────────────────────────
async function printViaWebUSB(data) {
  if (!('usb' in navigator)) throw new Error('WebUSB no disponible');

  // Re-use a previously paired device, or prompt the user to pick one
  let device;
  const paired = await navigator.usb.getDevices();
  if (paired.length > 0) {
    device = paired[0];
  } else {
    device = await navigator.usb.requestDevice({
      filters: [
        { classCode: 0x07 },   // USB Printer class — catches most thermal printers
        { vendorId: 0x04b8 },  // Epson
        { vendorId: 0x0519 },  // Star Micronics
        { vendorId: 0x0dd4 },  // Custom Engineering / Premier
        { vendorId: 0x1fc9 },  // Bixolon
        { vendorId: 0x0456 },  // Citizen
      ],
    });
  }

  await device.open();
  if (device.configuration === null) await device.selectConfiguration(1);

  // Prefer the USB Printer class interface (0x07); fall back to interface 0
  const cfg = device.configuration;
  let ifaceNum = 0;
  outer: for (const iface of cfg.interfaces) {
    for (const alt of iface.alternates) {
      if (alt.interfaceClass === 0x07) { ifaceNum = iface.interfaceNumber; break outer; }
    }
  }

  await device.claimInterface(ifaceNum);
  const alt = cfg.interfaces.find(i => i.interfaceNumber === ifaceNum).alternates[0];
  const ep  = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
  if (!ep) throw new Error('No se encontró endpoint bulk OUT en la impresora USB');

  await device.transferOut(ep.endpointNumber, data);
  await device.releaseInterface(ifaceNum);
  await device.close();
  return { ok: true };
}

/**
 * Print via USB.
 * Strategy: WebUSB first (Mac/Linux/Windows-WinUSB), then Web Serial fallback
 * (printers that appear as a COM port).
 * Returns { ok: true } or { ok: false, error: string }.
 */
export async function printViaUSB(order, widthMm = 80) {
  const data = buildEscPosBytes(order, widthMm);

  // ── 1. WebUSB (USB printer class) ────────────────────────────────────────
  if ('usb' in navigator) {
    try {
      return await printViaWebUSB(data);
    } catch (err) {
      // User dismissed the picker — stop, don't fall through
      if (err.name === 'NotFoundError' || err.name === 'AbortError') {
        return { ok: false, error: 'No se seleccionó ninguna impresora.' };
      }
      // On Windows the default USB printer driver blocks claimInterface.
      // Fall through to the Web Serial path silently.
    }
  }

  // ── 2. Web Serial fallback (COM port / RS-232 / USB-serial adapters) ─────
  if (!('serial' in navigator)) {
    return {
      ok: false,
      error: 'No se detectó la impresora USB. En Windows instala el driver WinUSB (Zadig) o activa el puerto COM en la impresora. Como alternativa usa el modo Red (TCP/IP).',
    };
  }
  try {
    let port;
    const ports = await navigator.serial.getPorts();
    if (ports.length > 0) {
      port = ports[0];
    } else {
      port = await navigator.serial.requestPort();
    }
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    await writer.write(data);
    writer.releaseLock();
    await port.close();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}
