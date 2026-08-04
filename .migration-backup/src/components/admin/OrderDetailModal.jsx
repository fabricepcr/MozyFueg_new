import React from 'react';
import { X, MapPin, Clock, Package, Bike, Store, CreditCard, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG = {
  payment_pending: { label: 'Pago pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  pending:         { label: 'Recibido',        color: 'bg-blue-100 text-blue-800 border-blue-200' },
  confirmed:       { label: 'Confirmado',      color: 'bg-blue-100 text-blue-800 border-blue-200' },
  preparing:       { label: 'Preparando',      color: 'bg-orange-100 text-orange-800 border-orange-200' },
  delivering:      { label: 'En camino',       color: 'bg-purple-100 text-purple-800 border-purple-200' },
  delivered:       { label: 'Entregado',       color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled:       { label: 'Cancelado',       color: 'bg-red-100 text-red-800 border-red-200' },
  refunded:        { label: 'Reembolsado',     color: 'bg-purple-100 text-purple-800 border-purple-200' },
};

const PAYMENT_LABELS = {
  efectivo: '💵 Efectivo',
  tarjeta:  '💳 Tarjeta',
  bizum:    '📱 Bizum',
  datafono: '💳 Datáfono a domicilio',
};

export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-md border-b px-5 py-4 flex items-center justify-between rounded-t-3xl sm:rounded-t-3xl z-10">
          <div>
            <h2 className="font-heading font-bold text-lg">Detalle del pedido</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
              {' · '}
              {new Date(order.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Estado */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground font-medium">Estado del pedido</span>
            <span className={`inline-flex items-center text-xs font-bold px-3 py-1.5 rounded-full border ${status.color}`}>
              {status.label}
            </span>
          </div>

          {/* Cliente */}
          <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Cliente</p>
            <p className="font-semibold text-sm">{order.customer_name}</p>
            <p className="text-sm text-muted-foreground">📞 {order.customer_phone}</p>
            {order.order_type === 'delivery' && order.customer_address && (
              <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                <span>{order.customer_address}</span>
              </div>
            )}
            {order.order_type === 'pickup' && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Store className="w-4 h-4 flex-shrink-0 text-primary" />
                <span>Recogida en local{order.pickup_time ? ` a las ${order.pickup_time}` : ''}</span>
              </div>
            )}
            {order.customer_notes && (
              <p className="text-sm text-muted-foreground">📝 {order.customer_notes}</p>
            )}
          </div>

          {/* Tipo de pedido y pago */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Tipo</p>
              <div className="flex items-center gap-1.5">
                {order.order_type === 'delivery'
                  ? <><Bike className="w-4 h-4 text-primary" /><span className="text-sm font-semibold">Delivery</span></>
                  : <><Store className="w-4 h-4 text-primary" /><span className="text-sm font-semibold">Recogida</span></>
                }
              </div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Pago</p>
              <p className="text-sm font-semibold">{PAYMENT_LABELS[order.payment_method] || order.payment_method}</p>
            </div>
          </div>

          {/* Productos */}
          <div className="bg-card border border-border/50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Productos</p>
            <div className="space-y-3">
              {(order.items || []).map((item, i) => (
                <div key={i} className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.quantity}x {item.name}</p>
                    {item.removed_ingredients?.length > 0 && (
                      <p className="text-xs text-red-500 mt-0.5">
                        Quitar: {item.removed_ingredients.map(r => r.replace(/^Sin /, '')).join(', ')}
                      </p>
                    )}
                    {item.extras?.length > 0 && (
                      <p className="text-xs text-green-600 mt-0.5">
                        Añadir: {item.extras.join(', ')}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-primary whitespace-nowrap">
                    {(item.price * item.quantity).toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>

            {/* Totales */}
            <div className="border-t mt-4 pt-4 space-y-1.5">
              {order.subtotal != null && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span><span>{order.subtotal.toFixed(2)} €</span>
                </div>
              )}
              {order.delivery_fee > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Envío{order.delivery_distance_km ? ` (${order.delivery_distance_km} km)` : ''}</span>
                  <span>{order.delivery_fee.toFixed(2)} €</span>
                </div>
              )}
              {order.tip > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Propina</span><span>+{order.tip.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <span className="font-heading font-bold">Total</span>
                <span className="font-heading font-bold text-lg text-primary">{order.total?.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Fechas extras */}
          {(order.delivered_at || order.refunded_at) && (
            <div className="space-y-1">
              {order.delivered_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Entregado: {new Date(order.delivered_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              {order.refunded_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Reembolsado: {new Date(order.refunded_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}