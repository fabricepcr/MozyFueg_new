import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle, Users, Phone, Calendar, Clock, MessageSquare, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

const WHATSAPP_NUMBER = '34640325113';

export default function Reservations() {
  const [form, setForm] = useState({
    customer_name: '',
    guests: '',
    customer_phone: '',
    desired_date: '',
    desired_time: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const update = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    await db.insert('reservations', {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      guests: parseInt(form.guests),
      desired_date: form.desired_date,
      desired_time: form.desired_time,
      message: form.message,
      status: 'pending',
    });

    const msg = `🍕 *NUEVA SOLICITUD DE RESERVA - Mozzarella y Fuego*

👤 *Nombre:* ${form.customer_name}
👥 *Personas:* ${form.guests}
📞 *Teléfono:* ${form.customer_phone}
📅 *Fecha:* ${form.desired_date}
🕐 *Hora:* ${form.desired_time}
${form.message ? `📝 *Mensaje:* ${form.message}` : ''}

_Por favor, confirme la disponibilidad._`;

    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');

    setSubmitting(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="font-body">
        <Navbar />
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="font-heading text-3xl font-bold mb-3">¡Solicitud enviada!</h2>
            <p className="text-muted-foreground mb-2">
              Tu solicitud ha sido registrada y se ha abierto WhatsApp con todos los datos.
            </p>
            <p className="text-muted-foreground text-sm mb-8">
              Te confirmaremos la disponibilidad lo antes posible.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setSent(false)} variant="outline">Nueva reserva</Button>
              <Link to="/"><Button className="bg-primary hover:bg-primary/90">Volver al inicio</Button></Link>
            </div>
          </motion.div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="font-body">
      <Navbar />
      <div className="min-h-screen bg-background">
        <div className="bg-foreground text-background py-16 px-6">
          <div className="max-w-2xl mx-auto text-center">
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-accent font-medium text-sm tracking-widest uppercase mb-3">
              Mozzarella y Fuego
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              Reservas
            </motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-background/70 text-lg">
              Asegura tu mesa y disfruta de la mejor experiencia
            </motion.p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-amber-900">¿Conoces nuestra política de reservas?</p>
              <p className="text-amber-700 text-sm mt-0.5">Turnos, precios, cancelaciones y más.</p>
            </div>
            <Link to="/politica-reservas">
              <Button variant="outline" size="sm" className="border-amber-400 text-amber-800 hover:bg-amber-100 whitespace-nowrap gap-2">
                <BookOpen className="w-4 h-4" />
                Leer política
              </Button>
            </Link>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-card border border-border/50 rounded-2xl p-5">
              <p className="font-heading font-semibold mb-2">🍕 Rodízio (Vie-Dom)</p>
              <p className="text-sm text-muted-foreground">Turno 1: <strong>19:00 – 21:00</strong></p>
              <p className="text-sm text-muted-foreground">Turno 2: <strong>21:30 – 23:30</strong></p>
              <p className="text-xs text-muted-foreground mt-2">25 € / adulto · Reserva obligatoria</p>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl p-5">
              <p className="font-heading font-semibold mb-2">🍽️ A la carta (Mar-Jue)</p>
              <p className="text-sm text-muted-foreground">Reserva anticipada disponible</p>
              <p className="text-sm text-muted-foreground">Vie-Dom: sujeto a disponibilidad</p>
              <p className="text-xs text-muted-foreground mt-2">Desde las 18:00 del mismo día</p>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card rounded-2xl border border-border/50 p-6 sm:p-8">
            <h2 className="font-heading text-2xl font-bold mb-6">Solicitar reserva</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="flex items-center gap-1.5 mb-1.5"><Users className="w-3.5 h-3.5" /> Nombre *</Label>
                  <Input id="name" placeholder="Tu nombre completo" value={form.customer_name} onChange={e => update('customer_name', e.target.value)} required className="rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="guests" className="flex items-center gap-1.5 mb-1.5"><Users className="w-3.5 h-3.5" /> Número de personas *</Label>
                  <Input id="guests" type="number" min="1" max="30" placeholder="Ej: 4" value={form.guests} onChange={e => update('guests', e.target.value)} required className="rounded-xl" />
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="flex items-center gap-1.5 mb-1.5"><Phone className="w-3.5 h-3.5" /> Teléfono *</Label>
                <Input id="phone" type="tel" placeholder="Tu número de teléfono" value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} required className="rounded-xl" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date" className="flex items-center gap-1.5 mb-1.5"><Calendar className="w-3.5 h-3.5" /> Fecha deseada *</Label>
                  <Input id="date" type="date" value={form.desired_date} onChange={e => update('desired_date', e.target.value)} min={new Date().toISOString().split('T')[0]} required className="rounded-xl" />
                </div>
                <div>
                  <Label htmlFor="time" className="flex items-center gap-1.5 mb-1.5"><Clock className="w-3.5 h-3.5" /> Hora deseada *</Label>
                  <Input id="time" type="time" value={form.desired_time} onChange={e => update('desired_time', e.target.value)} required className="rounded-xl" />
                </div>
              </div>
              <div>
                <Label htmlFor="msg" className="flex items-center gap-1.5 mb-1.5"><MessageSquare className="w-3.5 h-3.5" /> Mensaje adicional</Label>
                <Textarea id="msg" placeholder="Alergias, ocasiones especiales, preferencias..." value={form.message} onChange={e => update('message', e.target.value)} rows={3} className="rounded-xl" />
              </div>
              <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-6 text-base font-semibold">
                {submitting ? 'Enviando...' : '💬 Enviar solicitud por WhatsApp'}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Al enviar, se abrirá WhatsApp con tu solicitud. Te confirmaremos la reserva directamente.
              </p>
            </form>
          </motion.div>
        </div>
      </div>
      <Footer />
    </div>
  );
}