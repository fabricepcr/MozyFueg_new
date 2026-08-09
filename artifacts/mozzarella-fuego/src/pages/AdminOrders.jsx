import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Bike, CheckCircle, XCircle, Package, RefreshCw, ExternalLink, RotateCcw, AlertTriangle, ArrowLeft, Copy, Trash2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLogin from '@/components/admin/AdminLogin';
import ThermerShare from '@/components/admin/ThermerShare';
import OrderDetailModal from '@/components/admin/OrderDetailModal';
import StorePanel from '@/components/admin/StorePanel';
import PizzasPanel from '@/components/admin/PizzasPanel';
import DeliveryGuysPanel from '@/components/admin/DeliveryGuysPanel';
import ErrorBoundary from '@/components/ErrorBoundary';
import { initSound, startSoundLoop, stopSoundLoop, unlockSound, testSound, onSoundStateChange } from '@/lib/orderSound';


const STATUS_CONFIG = {
  pending:         { label: 'Recibido', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package },
  confirmed:       { label: 'Confirmado', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle },
  preparing:       { label: 'Preparando', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: ChefHat },
  delivering:      { label: 'En camino', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Bike },
  delivered:       { label: 'Entregado', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle },
  cancelled:       { label: 'Cancelado', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  refunded:        { label: 'Reembolsado', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: RotateCcw },
};

const PAYMENT_LABELS = { efectivo: '💵 Efectivo', tarjeta: '💳 Tarjeta', bizum: '📱 Bizum', datafono: '💳 Datáfono a domicilio' };
const ACTIVE_STATUSES = ['payment_pending', 'pending', 'confirmed', 'preparing', 'delivering'];

// Estados que deben disparar el aviso de "nuevo pedido".
const ALERTABLE_STATUSES = ['pending', 'confirmed'];

const TABS = [
  { key: 'pedidos',      label: '🍕 Pedidos' },
  { key: 'pizzas',       label: '🧀 Disponibilidad' },
  { key: 'tienda',       label: '🛵 Gestión de tienda' },
  { key: 'repartidores', label: '🏍️ Repartidores' },
];

const ADMIN_PASSWORD = 'mozzarellayfuego123';
const DRIVER_ASSIGN_STATUSES = ['confirmed', 'preparing', 'delivering'];

function AdminOrdersInner() {
  const [isAuthed, setIsAuthed] = useState(() => sessionStorage.getItem('admin_auth') === '1');
  const [activeTab, setActiveTab] = useState('pedidos');
  const [refundingId, setRefundingId] = useState(null);
  const [refundConfirmId, setRefundConfirmId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [soundOk, setSoundOk] = useState(false);
  const [assigningDriver, setAssigningDriver] = useState({});

  const alertedIdsRef = useRef(new Set());
  const seededRef = useRef(false);
  const queryClient = useQueryClient();

  const { data: drivers = [] } = useQuery({
    queryKey: ['delivery-guys'],
    queryFn: async () => {
      const res = await fetch('/api/admin/deliveryGuys', {
        headers: { 'x-admin-password': ADMIN_PASSWORD },
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
    refetchInterval: 8000,
    // 🔴 CLAVE: sin esto React Query PARA el polling cuando la pestaña
    // está en segundo plano -> el panel no se entera de nuevos pedidos.
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
    await db.update('orders', orderId, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
  };

  const handleAssignDriver = async (orderId, driverId) => {
    setAssigningDriver(prev => ({ ...prev, [orderId]: true }));
    try {
      await fetch(`/api/admin/orders/${orderId}/assignDriver`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': ADMIN_PASSWORD },
        body: JSON.stringify({ driver_id: driverId || null }),
      });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
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

        {activeTab === 'pizzas' && <PizzasPanel />}

        {activeTab === 'tienda' && <StorePanel />}

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
                    <div key={order.id} className={`bg-card rounded-2xl border-2 p-5 ${status.color.split(' ')[2] || 'border-border'}`}>
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

                      <div className="space-y-1 mb-3">
                        {(order.items || []).map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span className="text-muted-foreground">{(item.price * item.quantity).toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>

                      <Select value={order.status} onValueChange={val => updateStatus(order.id, val)}>
                        <SelectTrigger className="rounded-xl text-sm">
                          <SelectValue placeholder="Cambiar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                            <SelectItem key={val} value={val}>{cfg.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Driver assignment — only for delivery orders in active statuses */}
                      {order.order_type === 'delivery' && DRIVER_ASSIGN_STATUSES.includes(order.status) && (
                        <div className="mt-2">
                          <label className="text-xs text-muted-foreground font-medium mb-1 flex items-center gap-1">
                            <Bike className="w-3 h-3" /> Repartidor asignado
                          </label>
                          <Select
                            value={order.assigned_driver_id || 'none'}
                            onValueChange={val => handleAssignDriver(order.id, val === 'none' ? null : val)}
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

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <a href={`/repartidor?orderId=${order.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-xs bg-primary/10 text-primary border border-primary/20 rounded-xl py-2 hover:bg-primary/20 transition-colors font-medium">
                          <Bike className="w-3.5 h-3.5" />
                          Enlace repartidor
                        </a>
                        <a href={`/seguimiento?orderId=${order.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-xl py-2 hover:bg-blue-100 transition-colors font-medium">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ver seguimiento
                        </a>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <a href={`https://wa.me/?text=${encodeURIComponent(`Hola! Aquí tienes el enlace para el pedido: ${window.location.origin}/repartidor?orderId=${order.id}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-xl py-2 hover:bg-green-100 transition-colors font-medium">
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                          Enviar al repartidor
                        </a>
                        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/repartidor?orderId=${order.id}`); setCopiedId(order.id); setTimeout(() => setCopiedId(null), 2000); }} className="flex items-center justify-center gap-1.5 text-xs bg-muted text-muted-foreground border border-border rounded-xl py-2 hover:bg-muted/80 transition-colors font-medium">
                          {copiedId === order.id ? <><CheckCircle className="w-3.5 h-3.5 text-green-600" /><span className="text-green-600">¡Copiado!</span></> : <><Copy className="w-3.5 h-3.5" />Copiar enlace</>}
                        </button>
                      </div>
                      <ThermerShare order={order} />
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
