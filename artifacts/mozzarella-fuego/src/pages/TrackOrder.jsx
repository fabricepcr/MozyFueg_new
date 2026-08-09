import React, { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/db';
import { Loader2, MapPin, Package, ChefHat, Bike, CheckCircle2, Clock, Crosshair, CreditCard, XCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { motion } from 'framer-motion';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const driverIcon = L.divIcon({
  className: '',
  html: `<div style="background:#dc2626;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.45);font-size:22px;line-height:1;">🛵</div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
});

const destIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:32px;height:42px;">
    <svg viewBox="0 0 24 32" width="32" height="42" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 20 12 20S24 20.25 24 12C24 5.373 18.627 0 12 0z" fill="#EA4335"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>
  </div>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
});

const restaurantIcon = L.divIcon({
  className: '',
  html: `<div style="width:44px;height:44px;border-radius:50%;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.4);overflow:hidden;background:#f97316;">
    <img src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&h=100&fit=crop&crop=center" style="width:100%;height:100%;object-fit:cover;" />
  </div>`,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

const STATUS_STEPS = [
  { key: 'pending',    label: 'Pedido recibido',        icon: Package,      desc: 'El restaurante ha recibido tu pedido.',                   emoji: '📦', estimatedMin: 40 },
  { key: 'confirmed',  label: 'Pedido confirmado',      icon: CheckCircle2, desc: 'Tu pedido ha sido confirmado y está en cola.',            emoji: '✅', estimatedMin: 35 },
  { key: 'preparing',  label: 'Preparando pedido',      icon: ChefHat,      desc: 'Nuestros cocineros están preparando tu pizza.',           emoji: '👨‍🍳', estimatedMin: 20 },
  { key: 'delivering', label: 'Repartidor en camino',   icon: Bike,         desc: 'El repartidor está en camino con tu pedido.',             emoji: '🛵', estimatedMin: 10 },
  { key: 'delivered',  label: '¡Entregado!',            icon: CheckCircle2, desc: '¡Tu pizza ha llegado! ¡Que aproveche!',                   emoji: '🍕', estimatedMin: 0 },
];
const STATUS_ORDER = ['pending', 'confirmed', 'preparing', 'delivering', 'delivered'];
const FINISHED_STATUSES = ['delivered', 'cancelled', 'refunded'];

function isValidCoord(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
}

function MovingDriverMarker({ lat, lng }) {
  const markerRef = useRef(null);
  const animRef = useRef(null);
  const currentPos = useRef({ lat, lng });

  useEffect(() => {
    if (!markerRef.current || !isValidCoord(lat, lng)) return;
    const startLat = currentPos.current.lat;
    const startLng = currentPos.current.lng;
    if (startLat === lat && startLng === lng) return;
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const duration = 2000;
    const startTime = performance.now();
    const animate = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      if (markerRef.current) {
        markerRef.current.setLatLng([startLat + (lat - startLat) * ease, startLng + (lng - startLng) * ease]);
      }
      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        currentPos.current = { lat, lng };
      }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [lat, lng]);

  return (
    <Marker ref={markerRef} position={[lat, lng]} icon={driverIcon}>
      <Popup>🛵 Repartidor</Popup>
    </Marker>
  );
}

function MapFollowDriver({ lat, lng, followMode }) {
  const map = useMap();
  useEffect(() => {
    if (!followMode || !isValidCoord(lat, lng)) return;
    map.panTo([lat, lng], { animate: true, duration: 1.5, easeLinearity: 0.2 });
  }, [lat, lng, followMode]);
  return null;
}

export default function TrackOrder() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlOrderId = urlParams.get('orderId');
  // Si viene en la URL, usarlo; si no, recuperar el último pedido del navegador.
  const orderId = urlOrderId || localStorage.getItem('orderId');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualId, setManualId] = useState('');
  const [justUpdated, setJustUpdated] = useState(false);
  const [followMode, setFollowMode] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('ok');

  // Guardar SIEMPRE el pedido activo en el navegador para poder restaurarlo
  // aunque el cliente cierre la web, se le bloquee el móvil o se vaya y vuelva.
  useEffect(() => {
    if (orderId) localStorage.setItem('orderId', orderId);
  }, [orderId]);

  // Carga inicial via proxy (evita RLS) — con fallback a localStorage para pedidos locales
  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    if (orderId.startsWith('local_')) {
      const local = localStorage.getItem(`order_${orderId}`);
      setOrder(local ? JSON.parse(local) : null);
      setLoading(false);
      return;
    }
    db.selectOne('orders', { id: orderId }).then(data => {
      setOrder(data || null);
      setLoading(false);
      // Si el pedido ya terminó, dejamos de "recordarlo" como activo
      if (data && FINISHED_STATUSES.includes(data.status)) {
        // lo mantenemos visible en esta pantalla, pero el banner de otras
        // páginas dejará de mostrarlo
      }
    }).catch(() => setLoading(false));
  }, [orderId]);

  const applyOrderUpdate = useCallback((newData) => {
    setOrder(prev => {
      if (!prev) return newData;
      if (prev.status !== newData.status) {
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 3000);
      }
      const newLat = newData.driver_lat;
      const newLng = newData.driver_lng;
      if (isValidCoord(newLat, newLng)) {
        setLastUpdatedAt(new Date());
        setGpsStatus('ok');
      }
      return newData;
    });
  }, []);

  // Polling cada 3s via proxy
  useEffect(() => {
    if (!orderId || orderId.startsWith('local_')) return;
    const interval = setInterval(() => {
      db.selectOne('orders', { id: orderId }).then(data => {
        if (data) applyOrderUpdate(data);
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [orderId, applyOrderUpdate]);

  // GPS staleness
  useEffect(() => {
    const interval = setInterval(() => {
      if (!lastUpdatedAt) return;
      const secsSince = (Date.now() - lastUpdatedAt.getTime()) / 1000;
      setGpsStatus(secsSince > 30 ? 'stale' : 'ok');
    }, 5000);
    return () => clearInterval(interval);
  }, [lastUpdatedAt]);

  const handleMapDrag = useCallback(() => setFollowMode(false), []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  if (!orderId || !order) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm w-full">
        <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-lg font-semibold mb-1">
          {orderId ? 'Pedido no encontrado' : 'No hay pedidos activos'}
        </p>
        <p className="text-muted-foreground text-sm mb-6">
          {orderId ? 'Verifica el enlace recibido.' : 'Introduce tu código de pedido para ver el estado.'}
        </p>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Código de pedido"
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            className="flex-1 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <Button
            onClick={() => {
              if (manualId.trim()) {
                localStorage.setItem('orderId', manualId.trim());
                window.location.href = `/seguimiento?orderId=${manualId.trim()}`;
              }
            }}
            className="bg-primary text-white rounded-xl px-4"
          >
            Ver
          </Button>
        </div>
        <Link to="/" className="text-primary text-sm underline">Volver al inicio</Link>
      </div>
    </div>
  );

  // ─── Pedido cancelado / reembolsado por el restaurante ─────────────────────
  if (order.status === 'cancelled' || order.status === 'refunded') {
    const wasRefunded = order.status === 'refunded';
    return (
      <div className="min-h-screen bg-background font-body flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-slate-100 flex items-center justify-center">
            <XCircle className="w-11 h-11 text-slate-400" />
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Pedido cancelado</h1>
          <p className="text-muted-foreground text-sm mb-1">
            Lo sentimos, el restaurante ha cancelado este pedido.
          </p>
          <p className="text-muted-foreground text-sm mb-6">
            {wasRefunded
              ? 'El importe ha sido reembolsado a tu método de pago.'
              : 'Si tienes cualquier duda, ponte en contacto con el restaurante.'}
          </p>

          <div className="bg-card rounded-2xl border border-border/50 p-4 text-left mb-6">
            <p className="text-xs text-muted-foreground mb-1">Pedido #{orderId?.slice(-6).toUpperCase()}</p>
            {(order.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-0.5 text-foreground/80">
                <span>{item.quantity}x {item.name}</span>
                <span>{(item.price * item.quantity).toFixed(2)} €</span>
              </div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between font-bold text-sm">
              <span>Total</span>
              <span className="text-primary">{order.total?.toFixed(2)} €</span>
            </div>
          </div>

          <Link to="/">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl w-full">Volver al inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIndex = STATUS_ORDER.indexOf(order.status);
  const currentStep = STATUS_STEPS[currentStepIndex] || STATUS_STEPS[0];
  const isDelivering = order.status === 'delivering';
  const isDelivered = order.status === 'delivered';
  const driverLat = order.driver_lat;
  const driverLng = order.driver_lng;
  const showMap = (isDelivering || isDelivered) && isValidCoord(driverLat, driverLng);
  const progress = (Math.max(currentStepIndex, 0) / (STATUS_ORDER.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="bg-primary text-white px-5 py-5">
        <div className="max-w-lg mx-auto">
          <p className="font-heading font-bold text-xl">Seguimiento del pedido</p>
          <p className="text-white/70 text-sm mt-0.5">
            #{orderId?.slice(-6).toUpperCase()} · {order.customer_name}
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <motion.div
          key={order.status}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className={`rounded-2xl p-6 text-center shadow-sm border ${isDelivered ? 'bg-green-50 border-green-200' : 'bg-card border-border/50'}`}
        >
          <motion.div animate={isDelivered ? {} : { scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }} className="text-5xl mb-3">
            {currentStep.emoji}
          </motion.div>
          <h2 className={`font-heading font-bold text-2xl mb-1 ${isDelivered ? 'text-green-700' : 'text-foreground'}`}>{currentStep.label}</h2>
          <p className="text-muted-foreground text-sm">{currentStep.desc}</p>
          {currentStep.estimatedMin > 0 && !isDelivered && (
            <div className="mt-4 inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
              <Clock className="w-4 h-4" />~{currentStep.estimatedMin} min estimados
            </div>
          )}
          {justUpdated && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-xs text-green-600 font-medium">
              ✓ Estado actualizado
            </motion.div>
          )}
        </motion.div>

        <div className="bg-card rounded-2xl border border-border/50 p-5">
          <div className="relative mb-6">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between">
              {STATUS_STEPS.map((step, i) => {
                const done = currentStepIndex >= i;
                const active = currentStepIndex === i;
                return (
                  <motion.div key={step.key} animate={active ? { scale: [1, 1.3, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }} className={`w-4 h-4 rounded-full border-2 transition-all ${done ? 'bg-primary border-primary' : 'bg-background border-muted-foreground/30'} ${active ? 'ring-4 ring-primary/20' : ''}`} />
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            {STATUS_STEPS.map((step, i) => {
              const Icon = step.icon;
              const done = currentStepIndex >= i;
              const active = currentStepIndex === i;
              return (
                <div key={step.key} className={`flex items-center gap-3 transition-opacity ${done ? 'opacity-100' : 'opacity-40'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isDelivered && step.key === 'delivered' ? 'bg-green-500 text-white' : done ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</p>
                  </div>
                  {active && !isDelivered && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium animate-pulse">Ahora</span>}
                  {done && !active && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {isDelivering && !showMap && (
          <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-2xl">🛵</span>
            <div>
              <p className="text-sm font-semibold text-primary">Tu pizza está en camino</p>
              <p className="text-xs text-muted-foreground">El mapa aparecerá en cuanto el repartidor active el GPS.</p>
            </div>
          </div>
        )}

        {showMap && (
          <div className="rounded-2xl overflow-hidden border border-border/50 shadow-sm">
            <div className="bg-primary px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛵</span>
                <div>
                  <p className="text-sm font-bold text-white">¡Tu pizza está en camino!</p>
                  <p className="text-white/70 text-xs flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${gpsStatus === 'ok' ? 'bg-green-400 animate-pulse' : 'bg-yellow-300'}`} />
                    {gpsStatus === 'ok' ? 'En tiempo real' : 'Última ubicación conocida'}
                    {lastUpdatedAt && ` · hace ${Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000)}s`}
                  </p>
                </div>
              </div>
              {!followMode && (
                <Button size="sm" variant="secondary" className="h-8 text-xs gap-1 rounded-xl bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => setFollowMode(true)}>
                  <Crosshair className="w-3 h-3" /> Centrar
                </Button>
              )}
            </div>
            <div className="bg-card px-4 py-2 border-b border-border/50">
              <p className="text-xs text-muted-foreground">Sigue al repartidor en el mapa — se actualiza automáticamente</p>
            </div>
            <div className="h-60" style={{ position: 'relative' }}>
              <MapContainer center={[driverLat, driverLng]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false} whenCreated={map => { map.on('dragstart', handleMapDrag); }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
                <MapFollowDriver lat={driverLat} lng={driverLng} followMode={followMode} />
                <MovingDriverMarker lat={driverLat} lng={driverLng} />
                <Marker position={[41.4116, 2.1751]} icon={restaurantIcon}>
                  <Popup>🍕 Mozzarella y Fuego</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
          <p className="font-heading font-semibold text-sm">Resumen del pedido</p>

          {order.order_type === 'delivery' && order.customer_address ? (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              <span>{order.customer_address}</span>
            </div>
          ) : order.order_type === 'pickup' ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>🏠</span>
              <span>Recogida en local{order.pickup_time ? ` a las ${order.pickup_time}` : ''}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="w-4 h-4 flex-shrink-0 text-primary" />
            <span>{
              order.payment_method === 'datafono' || order.payment_method === 'card' ? 'Datáfono' :
              order.payment_method === 'efectivo' || order.payment_method === 'cash' ? 'Efectivo' :
              order.payment_method === 'bizum' ? 'Bizum' : 'Tarjeta'
            }</span>
          </div>

          <div className="border-t pt-3">
            {(order.items || []).map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-0.5 text-foreground/80">
                <span>{item.quantity}x {item.name}</span>
                <span>{(item.price * item.quantity).toFixed(2)} €</span>
              </div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-primary">{order.total?.toFixed(2)} €</span>
            </div>
          </div>

          {order.delivered_at && (
            <p className="text-xs text-muted-foreground">
              ✅ Entregado a las {new Date(order.delivered_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>

        {/* Link to order history */}
        <div className="mt-4 text-center">
          <a href="/mis-pedidos" className="text-sm text-muted-foreground hover:text-primary transition-colors underline underline-offset-4">
            Ver historial de pedidos
          </a>
        </div>
      </div>
    </div>
  );
}