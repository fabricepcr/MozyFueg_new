import React from 'react';
import { db } from '@/lib/db';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_CONFIG = {
  pending:   { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  confirmed: { label: 'Confirmada', color: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800 border-red-200' },
};

export default function AdminReservations() {
  const queryClient = useQueryClient();

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ['admin-reservations'],
    queryFn: () => db.select('reservations', {}),
    refetchInterval: 10000,
  });

  const updateStatus = async (id, status) => {
    await db.update('reservations', id, { status });
    queryClient.invalidateQueries({ queryKey: ['admin-reservations'] });
  };

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-muted rounded-2xl h-24 animate-pulse" />)}</div>;
  }

  if (reservations.length === 0) {
    return (
      <div className="bg-muted/40 rounded-2xl p-8 text-center text-muted-foreground">
        No hay reservas registradas
      </div>
    );
  }

  const pending = reservations.filter(r => r.status === 'pending');
  const rest = reservations.filter(r => r.status !== 'pending');

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div>
          <h3 className="font-heading font-semibold text-base mb-3 flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
            Pendientes de confirmar ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map(r => <ReservationCard key={r.id} reservation={r} onStatusChange={updateStatus} />)}
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div>
          <h3 className="font-heading font-semibold text-base mb-3 text-muted-foreground">Historial ({rest.length})</h3>
          <div className="space-y-3">
            {rest.map(r => <ReservationCard key={r.id} reservation={r} onStatusChange={updateStatus} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ReservationCard({ reservation: r, onStatusChange }) {
  const status = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{r.customer_name}</p>
          <p className="text-xs text-muted-foreground">📞 {r.customer_phone}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${status.color}`}>
          {status.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
        <span>📅 {r.desired_date}</span>
        <span>🕐 {r.desired_time}</span>
        <span>👥 {r.guests} personas</span>
        <span className="text-xs">{new Date(r.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
      </div>
      {r.message && <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2">📝 {r.message}</p>}
      <Select value={r.status} onValueChange={val => onStatusChange(r.id, val)}>
        <SelectTrigger className="rounded-xl text-sm h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pending">Pendiente</SelectItem>
          <SelectItem value="confirmed">Confirmada</SelectItem>
          <SelectItem value="cancelled">Cancelada</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}