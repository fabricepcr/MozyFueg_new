import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { UtensilsCrossed, Pizza, Truck } from 'lucide-react';

const cards = [
{
  icon: UtensilsCrossed,
  emoji: null,
  title: 'A la carta',
  color: 'from-amber-50 to-orange-50',
  border: 'border-amber-200',
  iconBg: 'bg-amber-100 text-amber-700',
  content:
  <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
        <p>Elige directamente de nuestro menú entre <strong className="text-foreground">pizzas saladas, pizzas dulces, bebidas y cócteles</strong>.</p>
        <p>También puedes combinar varios sabores en una misma pizza, respetando los límites indicados.</p>
        <div className="bg-white/70 rounded-xl p-3 border border-amber-100">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-1">Disponibilidad</p>
          <p>Mar–Jue: Reserva anticipada disponible</p>
          <p>Vie–Dom: Sujeto a disponibilidad de mesas</p>
        </div>
      </div>,

  cta: { label: 'Consultar política de reservas', to: '/politica-reservas' }
},
{
  icon: Pizza,
  emoji: null,
  title: 'Rodízio · Buffet libre',
  color: 'from-green-50 to-emerald-50',
  border: 'border-green-200',
  iconBg: 'bg-primary/10 text-primary',
  featured: true,
  content:
  <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
        <p>Nuestros camareros pasan por tu mesa con <strong className="text-foreground">diferentes variedades de pizzas recién hechas</strong>. Elige los sabores que más te gusten.</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white/70 rounded-xl p-2.5 border border-green-100 text-center">
            <p className="text-xs font-bold text-foreground">19:00 – 21:00</p>
            <p className="text-xs text-muted-foreground mt-0.5">Vie-Dom
</p>
          </div>
          <div className="bg-white/70 rounded-xl p-2.5 border border-green-100 text-center">
            <p className="text-xs font-bold text-foreground">21:30 – 23:30</p>
            <p className="text-xs text-muted-foreground mt-0.5">Vie–Dom</p>
          </div>
        </div>
        <div className="bg-white/70 rounded-xl p-3 border border-green-100">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-2">Precios</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span>Adultos y mayores de 11 años</span><span className="font-bold text-foreground">25 €</span></div>
            <div className="flex justify-between"><span>Niños 4–10 años</span><span className="font-bold text-foreground">12,50 €</span></div>
            <div className="flex justify-between"><span>Hasta 3 años</span><span className="font-bold text-green-600">Gratis</span></div>
          </div>
          <p className="text-xs mt-2 text-muted-foreground">Bebidas aparte. Mismo servicio para toda la mesa.</p>
        </div>
        <p className="text-xs">Mar–Jue: Rodízio por encargo para grupos de <strong className="text-foreground">mínimo 8 adultos</strong>.</p>
      </div>,
  cta: { label: 'Consultar política de reservas', to: '/politica-reservas' }
},
{
  icon: Truck,
  emoji: null,
  title: 'Delivery y Recogida',
  color: 'from-blue-50 to-indigo-50',
  border: 'border-blue-200',
  iconBg: 'bg-blue-100 text-blue-700',
  content:
  <div className="space-y-3 text-muted-foreground text-sm leading-relaxed">
        <p>Disponible de <strong className="text-foreground">martes a domingo, de 18:00 a 23:30</strong>, independientemente del servicio en sala.</p>
        <div className="bg-white/70 rounded-xl p-3 border border-blue-100 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span>Delivery (radio máx. 8 km)</span>
            <span className="font-bold text-foreground">hasta 60 min</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>Recogida en tienda</span>
            <span className="font-bold text-foreground">15–40 min</span>
          </div>
        </div>
        <div className="bg-white/70 rounded-xl p-3 border border-blue-100">
          <p className="font-semibold text-foreground text-xs uppercase tracking-wide mb-2">Métodos de pago</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-white border rounded-lg px-2 py-1">Tarjeta</span>
            
            
          </div>
        </div>
      </div>,

  cta: { label: 'Hacer un pedido', to: '/pedir' }
}];


export default function ServicesSection() {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12">
          
          <p className="text-primary font-medium text-sm tracking-widest uppercase mb-3">¿Cómo quieres disfrutarlo?</p>
          <h2 className="font-heading text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Nuestras opciones de servicio
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            <strong className="text-foreground">Restaurante brasileño Barcelona</strong>: ven a cenar, disfruta del rodízio o pide a domicilio. 
            <strong className="text-foreground"> Delivery de pizza en Barcelona</strong> hasta 8 km de radio, o recoge en local en 15–40 min.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {cards.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative bg-gradient-to-b ${card.color} rounded-2xl border ${card.border} p-6 flex flex-col ${card.featured ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                
                {card.featured &&
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-4 py-1 rounded-full">
                    Más popular
                  </div>
                }
                <div className="flex items-center gap-3 mb-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-heading font-bold text-xl text-foreground">{card.title}</h3>
                </div>
                <div className="flex-1">{card.content}</div>
                <div className="mt-6">
                  <Link to={card.cta.to}>
                    <Button
                      variant={card.featured ? 'default' : 'outline'}
                      className={`w-full rounded-xl ${card.featured ? 'bg-primary hover:bg-primary/90 text-primary-foreground' : ''}`}>
                      
                      {card.cta.label}
                    </Button>
                  </Link>
                </div>
              </motion.div>);

          })}
        </div>
      </div>
    </section>);

}