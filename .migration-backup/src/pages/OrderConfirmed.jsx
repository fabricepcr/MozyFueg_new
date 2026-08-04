import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { CheckCircle, Loader2, Clock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OrderConfirmed() {
  const urlParams = new URLSearchParams(window.location.search);
  const rawOrderId = urlParams.get('orderId');
  const isStripe = urlParams.get('stripe') === '1';
  // Cuando viene de Stripe, orderId es en realidad el stripe_session_id
  const orderId = isStripe ? null : rawOrderId;
  const sessionId = isStripe ? rawOrderId : urlParams.get('session_id');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (orderId) {
        for (let i = 0; i < 5; i++) {
          const data = await db.selectOne('orders', { id: orderId }).catch(() => null);
          if (data) { setOrder(data); localStorage.setItem('orderId', data.id); break; }
          await new Promise(r => setTimeout(r, 1500));
        }
        setLoading(false);
        return;
      }

      if (sessionId) {
        for (let i = 0; i < 10; i++) {
          const data = await db.selectOne('orders', { stripe_session_id: sessionId }).catch(() => null);
          if (data) { setOrder(data); localStorage.setItem('orderId', data.id); break; }
          await new Promise(r => setTimeout(r, 2000));
        }
        setLoading(false);
        return;
      }

      setLoading(false);
    };

    load();
  }, [orderId, sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">
          {sessionId ? 'Confirmando tu pago y pedido...' : 'Confirmando tu pedido...'}
        </p>
      </div>
    );
  }

  const resolvedOrderId = order?.id || orderId;

  return (
    <div className="min-h-screen bg-background font-body flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="font-heading text-3xl font-bold text-foreground mb-3">¡Pedido confirmado!</h1>
        <p className="text-muted-foreground mb-2">Tu pedido ha sido recibido y está siendo procesado.</p>
        {order && (
          <div className="bg-muted/40 rounded-2xl p-4 mb-6 text-left space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{order.customer_name}</span> · {order.customer_phone}
            </p>
            {order.order_type === 'pickup' ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Recogida en local a las {order.pickup_time}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Entrega a: {order.customer_address}</p>
            )}
            {order.payment_method === 'tarjeta' && (
              <p className="text-xs text-green-700 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Pago con tarjeta confirmado
              </p>
            )}
            <p className="text-sm font-bold text-primary">{order.total?.toFixed(2)} €</p>
          </div>
        )}
        {!order && sessionId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6 text-sm text-yellow-800">
            Tu pago fue procesado correctamente. El pedido se confirmará en breve.
          </div>
        )}
        <div className="flex flex-col gap-3">
          {resolvedOrderId && (
            <Link to={`/seguimiento?orderId=${resolvedOrderId}`}>
              <Button variant="outline" className="rounded-xl w-full">Seguir mi pedido en tiempo real</Button>
            </Link>
          )}
          <Link to="/">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl w-full px-8 py-5">Volver al inicio</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}