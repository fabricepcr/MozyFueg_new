import React, { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Bike, CheckCircle, MapPin, Loader2, AlertCircle, Navigation, Copy, RotateCcw } from 'lucide-react';

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function isValidCoord(lat, lng) {
  return typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);
}

// Construye una dirección LIMPIA para Google Maps.
// Quita el marcador " · CP " (que confunde a Maps) y garantiza que incluya la ciudad.
function buildMapsDestination(address) {
  if (!address || !address.trim()) return 'Barcelona, España';
  let dest = address.replace(/\s·\s*CP\s*/gi, ', ').trim();
  if (!/españa|spain/i.test(dest)) {
    if (!/barcelona/i.test(dest)) dest += ', Barcelona';
    dest += ', España';
  }
  return dest;
}

const MIN_DISTANCE_M = 3;
const THROTTLE_MS = 3000;

// Actualiza el pedido reintentando y VERIFICANDO que el cambio se guardó.
// Devuelve true solo si el estado quedó confirmado en la base de datos.
async function updateOrderReliable(orderId, fields, expectStatus, attempts = 4) {
  for (let i = 0; i < attempts; i++) {
    try {
      await db.update('orders', orderId, fields);
      const check = await db.selectOne('orders', { id: orderId });
      if (!expectStatus || (check && check.status === expectStatus)) return true;
    } catch (_) {
      // reintentar
    }
    await new Promise(r => setTimeout(r, 700 * (i + 1)));
  }
  return false;
}

export default function DriverView() {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('orderId');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [lastPos, setLastPos] = useState(null);
  const [starting, setStarting] = useState(false);
  const [delivering, setDelivering] = useState(false);
  const [gpsLabel, setGpsLabel] = useState('');
  const [copied, setCopied] = useState(false);

  const watchRef = useRef(null);
  const lastSentPos = useRef(null);
  const lastSentTime = useRef(0);
  const activeRef = useRef(false);

  // Carga inicial via proxy (evita RLS)
  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    db.selectOne('orders', { id: orderId }).then(data => {
      setOrder(data || null);
      setLoading(false);
      // Si el pedido ya estaba en camino (p.ej. recargó la página), reanudar GPS
      if (data && data.status === 'delivering') {
        activeRef.current = true;
        setTracking(true);
        startGps();
      }
    }).catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const sendPosition = useCallback((latitude, longitude) => {
    if (!activeRef.current || !orderId) return;
    if (!isValidCoord(latitude, longitude)) return;
    const now = Date.now();
    const prev = lastSentPos.current;
    if (now - lastSentTime.current < THROTTLE_MS) return;
    if (prev && distanceMeters(prev.lat, prev.lng, latitude, longitude) < MIN_DISTANCE_M) return;
    lastSentTime.current = now;
    lastSentPos.current = { lat: latitude, lng: longitude };
    db.update('orders', orderId, {
      driver_lat: latitude,
      driver_lng: longitude,
      driver_updated_at: new Date().toISOString(),
    }).catch(() => {});
  }, [orderId]);

  // Arranca el GPS. Es BEST-EFFORT: si el repartidor no da permiso, el pedido
  // sigue estando "en camino" igualmente (el estado ya se actualizó antes).
  function startGps() {
    if (!navigator.geolocation) { setGpsLabel('Este dispositivo no tiene GPS'); return; }
    setGpsLabel('Obteniendo ubicación...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setLastPos({ lat: latitude, lng: longitude });
        setGpsLabel('GPS activo');
        sendPosition(latitude, longitude);
        watchRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude: la, longitude: lo, accuracy } = position.coords;
            setLastPos({ lat: la, lng: lo });
            setGpsLabel(accuracy > 30 ? 'GPS débil' : 'GPS activo');
            sendPosition(la, lo);
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setGpsLabel('Ubicación desactivada (el pedido sigue en camino)');
            } else {
              setGpsLabel('GPS sin señal — reintentando...');
            }
          },
          { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
        );
      },
      (err) => {
        setGpsLabel(err.code === 1
          ? 'Ubicación desactivada (el pedido sigue en camino)'
          : 'No se pudo obtener el GPS (el pedido sigue en camino)');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // "Empezar reparto": primero marca el pedido como "en camino" de forma FIABLE
  // (admin y cliente lo ven al instante), y solo después intenta el GPS.
  const startDelivery = async () => {
    if (starting || tracking) return;
    setStatusError('');
    setStarting(true);
    const ok = await updateOrderReliable(orderId, { status: 'delivering' }, 'delivering');
    setStarting(false);
    if (!ok) {
      setStatusError('No se pudo iniciar el reparto. Comprueba tu conexión e inténtalo de nuevo.');
      return;
    }
    setOrder(prev => prev ? { ...prev, status: 'delivering' } : prev);
    activeRef.current = true;
    setTracking(true);
    startGps();
  };

  // "Pedido entregado": marca como entregado de forma FIABLE antes de parar el GPS.
  const finishDelivery = async () => {
    if (delivering) return;
    setStatusError('');
    setDelivering(true);
    const ok = await updateOrderReliable(
      orderId,
      { status: 'delivered', delivered_at: new Date().toISOString() },
      'delivered'
    );
    setDelivering(false);
    if (!ok) {
      setStatusError('No se pudo marcar como entregado. Inténtalo de nuevo.');
      return;
    }
    // Éxito → parar GPS y actualizar pantalla
    activeRef.current = false;
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setTracking(false);
    setOrder(prev => prev ? { ...prev, status: 'delivered' } : prev);
  };

  const copyAddress = async () => {
    const dest = buildMapsDestination(order?.customer_address);
    try {
      await navigator.clipboard.writeText(dest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback para navegadores sin clipboard API
      const ta = document.createElement('textarea');
      ta.value = dest;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (_) {}
      document.body.removeChild(ta);
    }
  };

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <Loader2 className="w-8 h-8 animate-spin text-white" />
    </div>
  );

  if (!orderId || !order) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6">
      <div className="text-center text-white">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <p className="text-lg font-semibold">Pedido no encontrado</p>
        <p className="text-gray-400 text-sm mt-1">Verifica el enlace que te envió el restaurante.</p>
      </div>
    </div>
  );

  const isDelivered = order.status === 'delivered';
  const mapsDestination = buildMapsDestination(order.customer_address);
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsDestination)}&travelmode=driving`;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-base">Panel del repartidor</p>
            <p className="text-gray-400 text-xs">Pedido #{orderId?.slice(-6)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 bg-gray-900 mx-4 mt-4 rounded-2xl border border-gray-800">
        <p className="text-xs text-gray-400 mb-1">Cliente</p>
        <p className="font-semibold">{order.customer_name}</p>
        <p className="text-gray-400 text-sm mt-1">📞 {order.customer_phone}</p>
        {order.customer_address && (
          <div className="mt-2">
            <p className="text-gray-400 text-sm flex items-start gap-1">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
              {order.customer_address}
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
              >
                <Navigation className="w-4 h-4" />
                Google Maps
              </a>
              <button
                onClick={copyAddress}
                className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
              >
                {copied ? <><CheckCircle className="w-4 h-4 text-green-400" /><span className="text-green-400">¡Copiada!</span></> : <><Copy className="w-4 h-4" />Copiar dirección</>}
              </button>
            </div>
            <p className="text-gray-500 text-[11px] mt-1.5">
              Si el mapa no cae en el punto exacto, usa "Copiar dirección" y pégala en Google Maps.
            </p>
          </div>
        )}
        {order.customer_notes && <p className="text-gray-500 text-xs mt-2 italic">📝 {order.customer_notes}</p>}
      </div>

      <div className="px-5 py-4 mx-4 mt-3 bg-gray-900 rounded-2xl border border-gray-800">
        <p className="text-xs text-gray-400 mb-2">Productos</p>
        {(order.items || []).map((item, i) => (
          <div key={i} className="flex justify-between text-sm py-1">
            <span>{item.quantity}x {item.name}</span>
            <span className="text-gray-400">{(item.price * item.quantity).toFixed(2)} €</span>
          </div>
        ))}
        <div className="border-t border-gray-800 mt-2 pt-2 flex justify-between font-bold">
          <span>Total</span>
          <span className="text-primary">{order.total?.toFixed(2)} €</span>
        </div>
      </div>

      {tracking && lastPos && (
        <div className={`mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center gap-3 ${gpsLabel === 'GPS débil' ? 'bg-yellow-900/30 border border-yellow-700/50' : 'bg-green-900/30 border border-green-700/50'}`}>
          <Navigation className={`w-5 h-5 ${gpsLabel === 'GPS débil' ? 'text-yellow-400' : 'text-green-400 animate-pulse'}`} />
          <div>
            <p className={`text-sm font-semibold ${gpsLabel === 'GPS débil' ? 'text-yellow-300' : 'text-green-300'}`}>{gpsLabel}</p>
            <p className="text-green-500 text-xs">{lastPos.lat.toFixed(5)}, {lastPos.lng.toFixed(5)}</p>
          </div>
        </div>
      )}

      {tracking && !lastPos && (
        <div className="mx-4 mt-3 bg-gray-800 border border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          <p className="text-gray-400 text-sm">{gpsLabel || 'Obteniendo señal GPS...'}</p>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-3 bg-red-900/30 border border-red-700/50 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {statusError && (
        <div className="mx-4 mt-3 bg-red-900/30 border border-red-700/50 rounded-2xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300 text-sm">{statusError}</p>
        </div>
      )}

      <div className="mt-auto p-5 space-y-3">
        {isDelivered ? (
          <div className="bg-green-900/40 border border-green-700 rounded-2xl p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-green-300 font-bold text-lg">¡Pedido entregado!</p>
            <p className="text-green-500 text-sm mt-1">El rastreo se ha detenido automáticamente.</p>
          </div>
        ) : !tracking ? (
          <Button onClick={startDelivery} disabled={starting} className="w-full bg-primary hover:bg-primary/90 text-white rounded-2xl py-7 text-xl font-bold shadow-lg disabled:opacity-70">
            {starting ? <><Loader2 className="w-6 h-6 mr-3 animate-spin" />Iniciando...</> : <><Bike className="w-6 h-6 mr-3" />Empezar reparto</>}
          </Button>
        ) : (
          <Button onClick={finishDelivery} disabled={delivering} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-2xl py-7 text-xl font-bold shadow-lg disabled:opacity-70">
            {delivering ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <CheckCircle className="w-6 h-6 mr-3" />}
            {delivering ? 'Guardando...' : 'Pedido entregado'}
          </Button>
        )}

        {statusError && !isDelivered && (
          <Button
            onClick={tracking ? finishDelivery : startDelivery}
            variant="outline"
            className="w-full rounded-2xl py-3 text-sm font-semibold bg-transparent border-gray-700 text-white hover:bg-gray-800"
          >
            <RotateCcw className="w-4 h-4 mr-2" /> Reintentar
          </Button>
        )}

        {tracking && !isDelivered && (
          <p className="text-center text-gray-500 text-xs">
            Rastreo activo · La ubicación se envía cada {THROTTLE_MS / 1000}s si te mueves. Mantén esta pantalla abierta.
          </p>
        )}
      </div>
    </div>
  );
}
