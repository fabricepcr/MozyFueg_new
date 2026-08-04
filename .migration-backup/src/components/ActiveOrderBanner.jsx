import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '@/lib/db';
import { Bike, X } from 'lucide-react';

// Estados que se consideran "activos" (el pedido sigue en curso).
const ACTIVE_STATUSES = ['payment_pending', 'pending', 'confirmed', 'preparing', 'delivering'];

const STATUS_TEXT = {
  payment_pending: 'Procesando pago',
  pending: 'Pedido recibido',
  confirmed: 'Pedido confirmado',
  preparing: 'Preparando tu pizza',
  delivering: 'Repartidor en camino',
};

/**
 * Muestra un aviso flotante con acceso al seguimiento del pedido activo.
 * Reaparece aunque el cliente cierre la web y vuelva, porque lee el pedido
 * guardado en localStorage. Se oculta solo cuando el pedido se entrega o cancela.
 *
 * Colócalo UNA vez en tu layout raíz (ver instrucciones).
 */
export default function ActiveOrderBanner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const orderId = typeof window !== 'undefined' ? localStorage.getItem('orderId') : null;

  useEffect(() => {
    setDismissed(false); // al cambiar de pedido, volver a mostrar
  }, [orderId]);

  useEffect(() => {
    if (!orderId) { setOrder(null); return; }

    let cancelled = false;

    const load = () => {
      // Pedido local (sin conexión al crear)
      if (orderId.startsWith('local_')) {
        try {
          const local = localStorage.getItem(`order_${orderId}`);
          if (!cancelled) setOrder(local ? JSON.parse(local) : null);
        } catch { if (!cancelled) setOrder(null); }
        return;
      }
      db.selectOne('orders', { id: orderId })
        .then(data => {
          if (cancelled) return;
          setOrder(data || null);
          // Si ya terminó, olvidarlo para que no reaparezca más
          if (data && !ACTIVE_STATUSES.includes(data.status)) {
            localStorage.removeItem('orderId');
          }
        })
        .catch(() => {});
    };

    load();
    const interval = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [orderId]);

  // No mostrar si: no hay pedido, ya terminó, fue descartado, o ya estás en el seguimiento.
  if (!orderId || !order) return null;
  if (!ACTIVE_STATUSES.includes(order.status)) return null;
  if (dismissed) return null;
  if (location.pathname.startsWith('/seguimiento')) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 px-4"
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-lg mx-auto bg-primary text-white rounded-2xl shadow-lg flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Bike className="w-5 h-5" />
        </div>
        <button
          onClick={() => navigate(`/seguimiento?orderId=${orderId}`)}
          className="flex-1 text-left min-w-0"
        >
          <p className="text-sm font-bold leading-tight">Tienes un pedido en curso</p>
          <p className="text-white/80 text-xs truncate">
            {STATUS_TEXT[order.status] || 'En proceso'} · Toca para ver el seguimiento
          </p>
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 hover:opacity-70 transition-opacity flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
