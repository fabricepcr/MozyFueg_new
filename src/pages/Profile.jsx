import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase.jsx';
import { ArrowLeft, Clock, ChefHat, Bike, CheckCircle, XCircle, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

const STATUS_CONFIG = {
  payment_pending: { label: 'Pago pendiente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  pending:         { label: 'Recibido', color: 'bg-blue-100 text-blue-800', icon: Package },
  confirmed:       { label: 'Confirmado', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  preparing:       { label: 'Preparando', color: 'bg-orange-100 text-orange-800', icon: ChefHat },
  delivering:      { label: 'En camino', color: 'bg-purple-100 text-purple-800', icon: Bike },
  delivered:       { label: 'Entregado', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled:       { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const PAYMENT_LABELS = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum' };

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u || null);
      setLoadingUser(false);
    });
  }, []);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['my-orders', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background font-body flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground text-lg mb-4">Inicia sesión para ver tus pedidos</p>
          <Button onClick={() => supabase.auth.signInWithOtp({ email: '' })} className="bg-primary">
            Iniciar sesión
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">Mis pedidos</h1>
            <p className="text-muted-foreground text-sm">{user.user_metadata?.full_name || user.email}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="bg-muted rounded-2xl h-32 animate-pulse" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">Aún no tienes pedidos</p>
            <Link to="/pedir" className="mt-4 inline-block">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4">Ver la carta</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map(order => {
              const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              const Icon = status.icon;
              return (
                <div key={order.id} className="bg-card rounded-2xl border border-border/50 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="font-heading font-bold text-lg text-primary mt-0.5">{order.total?.toFixed(2)} €</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${status.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {(order.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between text-sm text-foreground/80">
                        <span>{item.quantity}x {item.name}</span>
                        <span>{(item.price * item.quantity).toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 text-xs text-muted-foreground pt-3 border-t flex-wrap">
                    <span>📦 {order.order_type === 'delivery' ? 'Domicilio' : 'Recogida'}</span>
                    {order.customer_address && order.order_type === 'delivery' && (
                      <span>📍 {order.customer_address}</span>
                    )}
                    {order.payment_method && (
                      <span>💳 {PAYMENT_LABELS[order.payment_method] || order.payment_method}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}