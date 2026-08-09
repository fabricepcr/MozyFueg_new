import React, { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, RefreshCw, RotateCcw, Clock, Truck, Store, CreditCard, Banknote, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/lib/CartContext';
import { useToast } from '@/components/ui/use-toast';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  payment_pending: { label: 'Pago pendiente', className: 'bg-yellow-100 text-yellow-700' },
  pending:         { label: 'Recibido',        className: 'bg-amber-100 text-amber-700' },
  confirmed:       { label: 'Confirmado',      className: 'bg-blue-100 text-blue-700' },
  preparing:       { label: 'Preparando',      className: 'bg-orange-100 text-orange-700' },
  delivering:      { label: 'En camino',       className: 'bg-primary/10 text-primary' },
  delivered:       { label: 'Entregado ✓',     className: 'bg-green-100 text-green-700' },
  cancelled:       { label: 'Cancelado',       className: 'bg-red-100 text-red-600' },
  refunded:        { label: 'Reembolsado',     className: 'bg-slate-100 text-slate-600' },
};

const ACTIVE_STATUSES = new Set(['payment_pending', 'pending', 'confirmed', 'preparing', 'delivering']);

function statusBadge(status) {
  const cfg = STATUS[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function paymentLabel(method) {
  if (method === 'card' || method === 'datafono') return 'Datáfono';
  if (method === 'cash' || method === 'efectivo') return 'Efectivo';
  if (method === 'bizum') return 'Bizum';
  return method || 'Tarjeta';
}

// ── Fetch orders by phone ────────────────────────────────────────────────────
async function fetchOrdersByPhone(phone) {
  const res = await fetch('/api/supabaseProxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'select', table: 'orders', query: { customer_phone: phone } }),
  });
  const json = await res.json();
  // supabaseProxy returns { data: [...] }
  const rows = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
  // Sort newest first
  return rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ── Main component ───────────────────────────────────────────────────────────
export default function MisPedidos() {
  const navigate = useNavigate();
  const { addItem, clearCart } = useCart();
  const { toast } = useToast();

  const [phone, setPhone] = useState(() => localStorage.getItem('mf_customer_phone') || '');
  const [activePhone, setActivePhone] = useState(() => localStorage.getItem('mf_customer_phone') || '');
  const [phoneInput, setPhoneInput] = useState('');
  const [showPhoneForm, setShowPhoneForm] = useState(!localStorage.getItem('mf_customer_phone'));

  const { data: orders = [], isFetching, refetch } = useQuery({
    queryKey: ['mis-pedidos', activePhone],
    queryFn: () => fetchOrdersByPhone(activePhone),
    enabled: !!activePhone,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    const cleaned = phoneInput.trim();
    if (!cleaned) return;
    localStorage.setItem('mf_customer_phone', cleaned);
    setPhone(cleaned);
    setActivePhone(cleaned);
    setShowPhoneForm(false);
  };

  const handleChangePhone = () => {
    setPhoneInput(phone);
    setShowPhoneForm(true);
  };

  const handleRepeat = useCallback((orderItems) => {
    if (!orderItems?.length) return;
    // Add all items to cart (fresh UUIDs to avoid merging with existing)
    for (const item of orderItems) {
      const cartItem = {
        id: crypto.randomUUID(),
        name: item.name,
        price: item.price,
        _flavors: item.flavors?.length ? item.flavors.map(f => ({
          id: f.id, name: f.name, removed: f.removed || [],
        })) : null,
        _extras: item.extras || [],
        removed_ingredients: item.removed_ingredients || [],
        _originalItem: { id: item.menu_item_id, name: item.name },
      };
      for (let q = 0; q < (item.quantity || 1); q++) {
        addItem(cartItem);
      }
    }
    toast({ title: '¡Listo!', description: 'Los artículos se han añadido al carrito. Revisa antes de confirmar.' });
    navigate('/pedir');
  }, [addItem, navigate, toast]);

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link to="/pedir" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">Mis pedidos</h1>
          {activePhone && !showPhoneForm && (
            <button onClick={refetch} disabled={isFetching} className="ml-auto text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Phone lookup form */}
        {showPhoneForm ? (
          <div className="bg-card rounded-2xl border border-border/50 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Phone className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-semibold">¿Cuál es tu número?</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Buscaremos todos los pedidos asociados a tu teléfono.
            </p>
            <form onSubmit={handlePhoneSubmit} className="flex gap-3">
              <Input
                type="tel"
                placeholder="Ej: 612 345 678"
                value={phoneInput}
                onChange={e => setPhoneInput(e.target.value)}
                className="rounded-xl flex-1"
                autoFocus
              />
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">
                Buscar
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="w-3.5 h-3.5" />
              <span>Pedidos de <strong className="text-foreground">{activePhone}</strong></span>
            </div>
            <button onClick={handleChangePhone} className="text-xs text-primary hover:underline">
              Cambiar número
            </button>
          </div>
        )}

        {/* Orders list */}
        {!showPhoneForm && (
          <>
            {isFetching && orders.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3" />
                <p className="text-sm">Buscando pedidos...</p>
              </div>
            )}

            {!isFetching && orders.length === 0 && (
              <div className="text-center py-14">
                <p className="text-4xl mb-3">🍕</p>
                <p className="text-muted-foreground font-medium">No encontramos pedidos para este número.</p>
                <p className="text-muted-foreground text-sm mt-1">¿Es correcto el teléfono que usaste al pedir?</p>
              </div>
            )}

            <div className="space-y-4">
              {orders.map(order => {
                const items = Array.isArray(order.items) ? order.items : [];
                const isActive = ACTIVE_STATUSES.has(order.status);
                const date = new Date(order.created_at);
                const dateStr = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={order.id} className="bg-card rounded-2xl border border-border/50 p-5">
                    {/* Top row: date + status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{dateStr} · {timeStr}</p>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                          {order.order_type === 'delivery'
                            ? <><Truck className="w-3 h-3" /> Delivery</>
                            : <><Store className="w-3 h-3" /> Recogida</>
                          }
                          <span>·</span>
                          {order.payment_method === 'cash' || order.payment_method === 'efectivo'
                            ? <><Banknote className="w-3 h-3" /> {paymentLabel(order.payment_method)}</>
                            : <><CreditCard className="w-3 h-3" /> {paymentLabel(order.payment_method)}</>
                          }
                          {order.scheduled_for && (
                            <><span>·</span><Clock className="w-3 h-3" /> Programado {order.scheduled_for}</>
                          )}
                        </div>
                      </div>
                      {statusBadge(order.status)}
                    </div>

                    {/* Items */}
                    <div className="space-y-0.5 mb-3">
                      {items.slice(0, 4).map((item, i) => (
                        <div key={i} className="flex justify-between text-sm text-foreground/80">
                          <span className="truncate">{item.quantity}x {item.name}</span>
                          <span className="ml-2 flex-shrink-0 font-medium">{(item.price * item.quantity).toFixed(2)} €</span>
                        </div>
                      ))}
                      {items.length > 4 && (
                        <p className="text-xs text-muted-foreground">+{items.length - 4} más…</p>
                      )}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between border-t pt-3 mb-4">
                      <span className="text-sm text-muted-foreground">Total</span>
                      <span className="font-heading font-bold text-primary">{order.total?.toFixed(2)} €</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {isActive && (
                        <Link to={`/seguimiento?orderId=${order.id}`} className="flex-1">
                          <Button variant="outline" className="w-full rounded-xl text-sm flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Ver estado
                            <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                          </Button>
                        </Link>
                      )}
                      {items.length > 0 && order.status !== 'cancelled' && (
                        <Button
                          onClick={() => handleRepeat(items)}
                          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-sm flex items-center justify-center gap-1.5"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Repetir pedido
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
