import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Bike, CheckCircle, XCircle, Package, RefreshCw, RotateCcw, AlertTriangle, ArrowLeft, Trash2, Volume2, VolumeX, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLogin from '@/components/admin/AdminLogin';
// ThermerShare removed
import OrderDetailModal from '@/components/admin/OrderDetailModal';
import StorePanel from '@/components/admin/StorePanel';
import PizzasPanel from '@/components/admin/PizzasPanel';
import DeliveryGuysPanel from '@/components/admin/DeliveryGuysPanel';
import AdminMenu from '@/components/admin/AdminMenu';
import PrintConfig, { loadPrintConfig, triggerPrint } from '@/components/admin/PrintConfig';
import ErrorBoundary from '@/components/ErrorBoundary';
import { initSound, startSoundLoop, stopSoundLoop, unlockSound, testSound, onSoundStateChange } from '@/lib/orderSound';
import { useToast } from '@/components/ui/use-toast';


const STATUS_CONFIG = {
  pending:    { label: 'Recibido',     color: 'bg-orange-100 text-orange-800 border-orange-300', cardClass: 'bg-orange-50 border-orange-400',  icon: Package },
  confirmed:  { label: 'Confirmado',   color: 'bg-green-100 text-green-800 border-green-200',    cardClass: 'bg-card border-border',            icon: CheckCircle },
  preparing:  { label: 'Preparando',   color: 'bg-orange-100 text-orange-800 border-orange-200', cardClass: 'bg-card border-border',            icon: ChefHat },
  delivering: { label: 'En camino',    color: 'bg-purple-100 text-purple-800 border-purple-200', cardClass: 'bg-card border-border',            icon: Bike },
  delivered:  { label: 'Entregado',    color: 'bg-green-100 text-green-800 border-green-200',    cardClass: 'bg-card border-border',            icon: CheckCircle },
  cancelled:  { label: 'Cancelado',    color: 'bg-red-100 text-red-800 border-red-200',           cardClass: 'bg-card border-border',            icon: XCircle },
  refunded:   { label: 'Reembolsado',  color: 'bg-purple-100 text-purple-800 border-purple-200', cardClass: 'bg-card border-border',            icon: RotateCcw },
};

const PAYMENT_LABELS = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', bizum: '📱 Bizum', datafono: '💳 Datáfono a domicilio' };
const ACTIVE_STATUSES = ['payment_pending', 'pending', 'confirmed', 'preparing', 'delivering'];

// Estados que deben disparar el aviso de "nuevo pedido".
const ALERTABLE_STATUSES = ['pending', 'confirmed'];

const TABS = [
  { key: 'pedidos',      label: '🍕 Pedidos' },
  { key: 'carta',        label: '📋 Carta' },
  { key: 'pizzas',       label: '🧀 Disponibilidad' },
  { key: 'tienda',       label: '🛵 Tienda' },
  { key: 'repartidores', label: '🏍️ Repartidores' },
];

// Include 'pending' so staff can pre-assign a driver before confirming, making
// the confirm → WhatsApp flow work atomically in one status change.
const DRIVER_ASSIGN_STATUSES = ['pending', 'confirmed', 'preparing', 'delivering'];

// Linear status progression — drives the big "next step" button on each card.
const STATUS_NEXT = {
  pending:    { status: 'confirmed',  label: 'Confirmar pedido' },
  confirmed:  { status: 'preparing',  label: 'Preparando' },
  preparing:  { status: 'delivering', label: 'En camino' },
  delivering: { status: 'delivered',  label: 'Entregado' },
};

async function notifyAllDriversWhatsApp(order) {
  try {
    const res = await fetch('/api/admin/notifyAllDrivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ order }),
    });
    const data = await res.json();
    if (!res.ok || data.error) return { ok: false, error: data.error || 'Error al enviar' };
    return { ok: true, sent: data.sent, failed: data.failed };
  } catch (err) {
    return { ok: false, error: err?.message || 'Error de conexión' };
  }
}

async function notifyDriverWhatsApp(order, driverId) {
  if (!driverId) return { ok: false, error: 'Sin repartidor asignado' };
  try {
    // Fetch driver details
    const driverRes = await fetch('/api/admin/deliveryGuys', { credentials: 'include' });
    const driverJson = await driverRes.json();
    const driver = (driverJson.data || []).find(d => d.id === driverId);
    if (!driver) return { ok: false, error: 'Repartidor no encontrado' };

    const res = await fetch('/api/admin/notifyDriver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ order, driver }),
    });
    const data = await res.json();
    if (!res.ok || data.error) return { ok: false, error: data.error || 'Error de WhatsApp' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Error de conexión' };
  }
}

function AdminOrdersInner() {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('admin_auth') === '1');
  const [activeTab, setActiveTab] = useState('pedidos');
  const { toast } = useToast();

  // Verify the server session is still valid on mount (e.g. after page reload or expiry).
  useEffect(() => {
    if (!isAuthed) return;
    fetch('/api/admin/me', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (!data.authed) {
          sessionStorage.removeItem('admin_auth');
          setIsAuthed(false);
        }
      })
      .catch(() => {}); // network error — keep showing UI; next API call will 401
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [refundingId, setRefundingId] = useState(null);
  const [refundConfirmId, setRefundConfirmId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [soundOk, setSoundOk] = useState(false);
  const [assigningDriver, setAssigningDriver] = useState({});
  const [advancingStatus, setAdvancingStatus] = useState({});

  const alertedIdsRef = useRef(new Set());
  const seededRef = useRef(false);
  const queryClient = useQueryClient();

  const { data: drivers = [] } = useQuery({
    queryKey: ['delivery-guys'],
    queryFn: async () => {
      const res = await fetch('/api/admin/deliveryGuys', {
        credentials: 'include',
      });
      const json = await res.json();
      return json.data || [];
    },
    enabled: isAuthed,
    staleTime: 30000,
  });

  const { data: orders = [], isLoading, isSuccess, refetch } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const data = await db.select('orders', {});
      return data || [];
    },
    refetchInterval: 30000, // SSE handles realtime; polling is a fallback
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });

  // Sistema de sonido: desbloqueo por gesto, reanudación al volver a la
  // pestaña y watchdog cada 5 s.
  useEffect(() => {
    initSound();
    const off = onSoundStateChange(setSoundOk);
    return () => { off(); stopSoundLoop(); };
  }, []);

  // Detectar nuevos pedidos y avisar (sonido + banner + notificación).
  useEffect(() => {
    if (!isAuthed) return;
    // Esperar a que la PRIMERA carga real haya terminado, si no se "gasta"
    // el seed con orders=[] y luego los pedidos antiguos parecen nuevos.
    if (!isSuccess) return;

    if (!seededRef.current) {
      orders.forEach(o => alertedIdsRef.current.add(o.id));
      seededRef.current = true;
      return;
    }

    const fresh = orders.filter(
      o => ALERTABLE_STATUSES.includes(o.status) && !alertedIdsRef.current.has(o.id)
    );
    fresh.forEach(o => alertedIdsRef.current.add(o.id));

    if (fresh.length > 0) {
      startSoundLoop();
      setNewOrderAlert(true);
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🍕 ¡Nuevo pedido!', { body: 'Ha llegado un nuevo pedido en Mozzarella y Fuego', icon: '/favicon.ico' });
        }
      } catch (_) { /* la notificación nunca debe romper el panel */ }
    }
  }, [orders, isAuthed, isSuccess]);

  // SSE: instant push when a new order arrives — refetch immediately instead of
  // waiting for the 30 s polling fallback. Auto-reconnects with backoff.
  useEffect(() => {
    if (!isAuthed) return;
    let es;
    let retryTimer;
    let retryDelay = 2000;

    function connect() {
      es = new EventSource('/api/admin/orderStream', { withCredentials: true });
      es.onopen = () => { retryDelay = 2000; };
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'new_order') {
            queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
          }
        } catch (_) {}
      };
      es.onerror = () => {
        es.close();
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, 30000);
          connect();
        }, retryDelay);
      };
    }

    connect();
    return () => { if (es) es.close(); clearTimeout(retryTimer); };
  }, [isAuthed, queryClient]);

  // Orders refresh on visibility change / reconnect (replaces Supabase Realtime).
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== 'visible') return;
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    return () => {
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [queryClient]);

  const updateStatus = async (orderId, newStatus) => {
    if (newStatus === 'cancelled') {
      setRefundConfirmId(orderId);
      return;
    }

    // ── Confirmation: unified flow that updates status + print + WhatsApp ──
    if (newStatus === 'confirmed') {
      const cfg = loadPrintConfig();
      const parts = [];

      // ── Browser-side print FIRST (USB / dialog modes require a live user gesture)
      // Always print on confirm — trigger before any async server call so the
      // activation context is preserved for window.print() / USB.
      if (cfg.print_mode !== 'network') {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          const printResult = await triggerPrint(order, cfg);
          parts.push(printResult.ok ? '🖨️ Ticket enviado' : `🖨️ Error: ${printResult.error}`);
        }
      }

      // ── Server call: persists status + runs network print ──
      const printerConfig = cfg.print_mode === 'network'
        ? { mode: 'network', ip: cfg.network_ip, port: cfg.network_port || '9100', widthMm: cfg.printer_id === 'generic-58' ? 58 : 80 }
        : null;

      const body = {
        ...(printerConfig ? { printer_config: printerConfig } : {}),
        whatsapp: cfg.whatsapp_enabled === true,
      };

      const res = await fetch(`/api/admin/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });

      if (!res.ok) {
        toast({ title: '❌ Error al confirmar', description: data.error, variant: 'destructive', duration: 5000 });
        return;
      }

      if (data.print) {
        parts.push(data.print.ok ? '🖨️ Ticket enviado' : `🖨️ Error impresora: ${data.print.error}`);
      }
      if (data.whatsapp) {
        parts.push(data.whatsapp.ok ? '💬 WhatsApp enviado' : `💬 Error WA: ${data.whatsapp.error}`);
      }

      if (parts.length > 0) {
        const allOk = parts.every(p => !p.includes('Error'));
        toast({
          title: allOk ? '✅ Pedido confirmado' : '⚠️ Pedido confirmado (con avisos)',
          description: parts.join(' · '),
          duration: 6000,
          variant: allOk ? 'default' : 'destructive',
        });
      } else {
        toast({ title: '✅ Pedido confirmado', duration: 3000 });
      }
      return;
    }

    // ── Other status changes ────────────────────────────────────────────────
    await db.update('orders', orderId, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  // Advance order to next status; on confirm → also broadcast WhatsApp + print.
  const handleAdvanceStatus = async (order) => {
    const next = STATUS_NEXT[order.status];
    if (!next) return;
    setAdvancingStatus(prev => ({ ...prev, [order.id]: true }));
    try {
      if (next.status === 'confirmed') {
        // existing confirm flow handles print
        await updateStatus(order.id, 'confirmed');
        // always notify ALL active drivers on confirmation
        const waResult = await notifyAllDriversWhatsApp(order);
        if (waResult.ok && waResult.sent > 0) {
          toast({ title: `📱 ${waResult.sent} repartidor${waResult.sent === 1 ? '' : 'es'} avisado${waResult.sent === 1 ? '' : 's'}`, duration: 3000 });
        }
      } else {
        await updateStatus(order.id, next.status);
        toast({ title: `✅ ${STATUS_CONFIG[next.status]?.label}`, duration: 2000 });
      }
    } finally {
      setAdvancingStatus(prev => ({ ...prev, [order.id]: false }));
    }
  };

  const handleReprintOrder = async (order) => {
    const cfg = loadPrintConfig();
    const result = await triggerPrint(order, cfg);
    toast({
      title: result.ok ? '✅ Ticket reenviado' : '⚠️ Error al reimprimir',
      description: result.message || result.error,
      duration: 4000,
      variant: result.ok ? 'default' : 'destructive',
    });
  };

  const handleAssignDriver = async (order, driverId) => {
    const orderId = order.id;
    setAssigningDriver(prev => ({ ...prev, [orderId]: true }));
    try {
      await fetch(`/api/admin/orders/${orderId}/assignDriver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ driver_id: driverId || null }),
      });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });

      // Auto-send WhatsApp via green-api when a driver is assigned
      if (driverId) {
        const result = await notifyDriverWhatsApp(order, driverId);
        if (result.ok) {
          toast({ title: '✅ WhatsApp enviado al repartidor', duration: 3000 });
        } else {
          toast({ title: '⚠️ WhatsApp no enviado', description: result.error, variant: 'destructive', duration: 5000 });
        }
      }
    } finally {
      setAssigningDriver(prev => ({ ...prev, [orderId]: false }));
    }
  };

  const handleCancelOrder = async (orderId) => {
    setRefundingId(orderId);
    setRefundConfirmId(null);
    await db.update('orders', orderId, { status: 'cancelled' });
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    setRefundingId(null);
  };

  const handleClearHistory = async () => {
    setClearingHistory(true);
    setClearConfirm(false);
    const toDelete = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));
    if (toDelete.length > 0) {
      await db.deleteMany('orders', toDelete.map(o => o.id));
    }
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    setClearingHistory(false);
  };

  // Al hacer login: desbloquear audio y pedir permiso de notificaciones
  // (ambas cosas necesitan un gesto real del usuario para funcionar).
  const handleLoginSuccess = () => {
    unlockSound();
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (_) {}
    setIsAuthed(true);
  };

  if (!isAuthed) {
    return <AdminLogin onSuccess={handleLoginSuccess} />;
  }

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  const pastOrders = orders.filter(o => !ACTIVE_STATUSES.includes(o.status));

  return (
    <div className="min-h-screen bg-background font-body">
      {newOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-500 text-white flex items-center justify-between py-3 px-4 font-semibold text-sm shadow-lg">
          <span>🍕 ¡Nuevo pedido recibido! Revisa los pedidos activos.</span>
          <button onClick={() => { setNewOrderAlert(false); stopSoundLoop(); }} className="ml-4 hover:opacity-70 transition-opacity flex-shrink-0">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
      )}
      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">Panel de pedidos</h1>
              <p className="text-muted-foreground text-sm">Mozzarella y Fuego</p>
            </div>
          </div>
          {activeTab === 'pedidos' && (
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Actualizar
            </Button>
          )}
        </div>

        {/* Estado del sonido */}
        {!soundOk ? (
          <button
            onClick={testSound}
            className="w-full mb-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-800 font-semibold py-4 px-4 flex items-center justify-center gap-2 hover:bg-amber-100 transition-colors"
          >
            <VolumeX className="w-5 h-5" />
            🔇 Sonido bloqueado — pulsa aquí para activar el aviso de pedidos
          </button>
        ) : (
          <button
            onClick={testSound}
            className="w-full mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-xs font-medium py-2 px-4 flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
          >
            <Volume2 className="w-4 h-4" />
            Sonido activo — pulsa para probar el timbre
          </button>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mb-6">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${activeTab === tab.key ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'carta' && <AdminMenu />}

        {activeTab === 'pizzas' && <PizzasPanel />}

        {activeTab === 'tienda' && (
          <div className="space-y-8">
            <StorePanel />
            <div>
              <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
                🖨️ Impresora y notificaciones
              </h2>
              <PrintConfig />
            </div>
          </div>
        )}

        {activeTab === 'repartidores' && <DeliveryGuysPanel />}

        {activeTab === 'pedidos' && <>
          <section className="mb-10">
            <h2 className="font-heading font-semibold text-lg mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
              Pedidos activos ({activeOrders.length})
            </h2>

            {isLoading ? (
              <div className="space-y-4">{[1,2].map(i => <div key={i} className="bg-muted rounded-2xl h-40 animate-pulse" />)}</div>
            ) : activeOrders.length === 0 ? (
              <div className="bg-muted/40 rounded-2xl p-8 text-center text-muted-foreground">
                No hay pedidos activos en este momento
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {activeOrders.map(order => {
                  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                  const Icon = status.icon;
                  return (
                    <div key={order.id} className={`rounded-2xl border-2 p-5 ${status.cardClass || 'bg-card border-border'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                          </p>
                          <p className="font-heading font-bold text-xl text-primary mt-0.5">{order.total?.toFixed(2)} €</p>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${status.color}`}>
                          <Icon className="w-3 h-3" />
                          {status.label}
                        </span>
                      </div>

                      <div className="bg-muted/40 rounded-xl p-3 mb-3 text-sm space-y-1">
                        <p className="font-semibold">{order.customer_name}</p>
                        <p className="text-muted-foreground">📞 {order.customer_phone}</p>
                        {order.order_type === 'delivery' && order.customer_address && (
                          <p className="text-muted-foreground">📍 {order.customer_address}</p>
                        )}
                        {order.order_type === 'pickup' && <p className="text-muted-foreground">🏠 Recogida en local</p>}
                        <p className="text-muted-foreground">{PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
                        {order.customer_notes && <p className="text-muted-foreground">📝 {order.customer_notes}</p>}
                      </div>

                      <div className="space-y-1.5 mb-3">
                        {(order.items || []).map((item, i) => (
                          <div key={i} className="text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">{item.quantity}x {item.name}</span>
                              <span className="text-muted-foreground ml-2 flex-shrink-0">{(item.price * item.quantity).toFixed(2)} €</span>
                            </div>
                            {(item.flavors || []).length > 0 && (
                              <div className="ml-3 mt-0.5 space-y-0.5">
                                {item.flavors.map((f, fi) => (
                                  <div key={fi}>
                                    <div className="text-xs text-muted-foreground">↳ {f.name.replace(/^Pizza /i, '')}</div>
                                    {(f.toppings || []).map((t, ti) => (
                                      <div key={ti} className="text-xs text-emerald-700 ml-3">+ {t.name}</div>
                                    ))}
                                    {(f.removed || []).map((r, ri) => (
                                      <div key={ri} className="text-xs text-red-500 ml-3">− {r}</div>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                            {(item.extras || []).length > 0 && (
                              <div className="ml-3 mt-0.5 space-y-0.5">
                                {item.extras.map((e, ei) => (
                                  <div key={ei} className="text-xs text-blue-600">+ {e.name}</div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* ── Big next-status button ── */}
                      {STATUS_NEXT[order.status] && (
                        <button
                          onClick={() => handleAdvanceStatus(order)}
                          disabled={!!advancingStatus[order.id]}
                          className="w-full mt-3 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold rounded-xl py-3.5 text-sm transition-colors shadow-sm"
                        >
                          {advancingStatus[order.id]
                            ? <><RotateCcw className="w-4 h-4 animate-spin" /> Procesando...</>
                            : <><CheckCircle className="w-4 h-4" /> {STATUS_NEXT[order.status].label}</>
                          }
                        </button>
                      )}

                      {/* Driver assignment — delivery orders only */}
                      {order.order_type === 'delivery' && DRIVER_ASSIGN_STATUSES.includes(order.status) && (
                        <div className="mt-2">
                          <label className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                            <Bike className="w-3 h-3" /> Repartidor asignado
                          </label>
                          <Select
                            value={order.assigned_driver_id || 'none'}
                            onValueChange={val => handleAssignDriver(order, val === 'none' ? null : val)}
                            disabled={assigningDriver[order.id]}
                          >
                            <SelectTrigger className="rounded-xl text-sm bg-purple-50 border-purple-200">
                              <SelectValue placeholder="Asignar repartidor…" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— Sin asignar —</SelectItem>
                              {drivers.filter(d => d.active).map(d => (
                                <SelectItem key={d.id} value={d.id}>{d.name} · {d.phone}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Cancel */}
                      {refundConfirmId === order.id ? (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3">
                          <p className="text-red-800 text-xs font-semibold flex items-center gap-1 mb-2">
                            <AlertTriangle className="w-3.5 h-3.5" /> ¿Confirmar cancelación del pedido?
                          </p>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1 text-xs rounded-lg" onClick={() => setRefundConfirmId(null)}>No</Button>
                            <Button size="sm" className="flex-1 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white" disabled={refundingId === order.id} onClick={() => handleCancelOrder(order.id)}>
                              {refundingId === order.id ? <><RotateCcw className="w-3 h-3 animate-spin mr-1" />Procesando...</> : 'Sí, cancelar'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5 rounded-xl text-xs border-red-200 text-red-700 hover:bg-red-50" onClick={() => setRefundConfirmId(order.id)}>
                          <XCircle className="w-3.5 h-3.5" />
                          Cancelar pedido
                        </Button>
                      )}

                      {/* Broadcast to all drivers — delivery only */}
                      {order.order_type === 'delivery' && (
                        <button
                          onClick={async () => {
                            const result = await notifyAllDriversWhatsApp(order);
                            if (result.ok) {
                              toast({ title: `✅ Mensaje enviado a ${result.sent} repartidor${result.sent === 1 ? '' : 'es'}`, duration: 3000 });
                            } else {
                              toast({ title: '⚠️ Error al avisar', description: result.error, variant: 'destructive', duration: 4000 });
                            }
                          }}
                          className="w-full flex items-center justify-center gap-1.5 text-xs bg-green-600 text-white rounded-xl py-2 hover:bg-green-700 transition-colors font-medium mt-2"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          Avisar a todos los repartidores
                        </button>
                      )}

                      {/* Reprint */}
                      <button
                        onClick={() => handleReprintOrder(order)}
                        className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded-xl py-2 hover:bg-gray-100 transition-colors font-medium"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Reimprimir ticket
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {pastOrders.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-semibold text-lg text-muted-foreground">Historial ({pastOrders.length})</h2>
                {clearConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600 font-semibold">¿Borrar todo?</span>
                    <Button size="sm" variant="outline" className="text-xs rounded-lg h-7" onClick={() => setClearConfirm(false)}>No</Button>
                    <Button size="sm" className="text-xs rounded-lg h-7 bg-red-600 hover:bg-red-700 text-white" disabled={clearingHistory} onClick={handleClearHistory}>
                      {clearingHistory ? <RotateCcw className="w-3 h-3 animate-spin" /> : 'Sí, borrar'}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="text-xs rounded-lg gap-1.5 border-red-200 text-red-600 hover:bg-red-50" onClick={() => setClearConfirm(true)}>
                    <Trash2 className="w-3.5 h-3.5" /> Borrar historial
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {pastOrders.map(order => {
                  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.delivered;
                  const Icon = status.icon;
                  return (
                    <button
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="w-full bg-card rounded-xl border border-border/50 p-4 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{order.customer_name} · <span className="text-primary font-bold">{order.total?.toFixed(2)} €</span></p>
                        <p className="text-xs text-muted-foreground truncate">
                          {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          {order.order_type === 'pickup' ? ' · Recogida en local' : order.customer_address ? ` · ${order.customer_address}` : ''}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${status.color}`}>
                        <Icon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}
        </>}
      </div>
    </div>
  );
}

export default function AdminOrders() {
  return (
    <ErrorBoundary>
      <AdminOrdersInner />
    </ErrorBoundary>
  );
}
