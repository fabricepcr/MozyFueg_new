import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const PIZZA_IMAGE = 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/f34f6be57_image.png';

const highlights = [
  { name: 'Frango Catupiry', desc: 'Pollo mechado y requesón catupiry', price: '18,90 €' },
  { name: 'Calabresa', desc: 'Calabresa brasileña y pimienta calabresa', price: '18,90 €' },
  { name: 'Del Chef', desc: 'Ternera, maíz, gorgonzola, tomate cherry', price: '20,90 €' },
  { name: 'Strogonoff', desc: 'Ternera en salsa de nata con patata paja', price: '16,90 €' },
];

export default function MenuPreview() {
  return (
    <section id="menu" className="py-20 sm:py-28 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <p className="text-primary font-medium text-sm tracking-[0.2em] uppercase mb-3">Nuestra carta</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Sabores que <span className="text-primary italic">enamoran</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Más de 30 <strong className="text-foreground">pizzas brasileñas artesanales</strong> con recetas únicas: pizzas saladas, <strong className="text-foreground">pizzas dulces Barcelona</strong> y bebidas. 
            Disponibles en 24 cm y 33 cm. También en <strong className="text-foreground">rodízio buffet libre</strong> los fines de semana.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center mb-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-2xl overflow-hidden shadow-xl"
          >
            <img
              src={PIZZA_IMAGE}
              alt="Pizza artesanal brasileña de Mozzarella y Fuego Barcelona, con masa casera y ingredientes frescos"
              loading="lazy"
              decoding="async"
              width="600"
              height="450"
              className="w-full h-[350px] sm:h-[450px] object-cover"
            />
          </motion.div>

          <div className="space-y-4">
            {highlights.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-background rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow border border-border/50"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-heading font-semibold text-lg text-foreground">{item.name}</h3>
                    <p className="text-muted-foreground text-sm mt-1">{item.desc}</p>
                  </div>
                  <span className="font-heading font-bold text-primary text-lg whitespace-nowrap ml-4">{item.price}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link to="/pedir">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-10 py-6 text-lg gap-2 shadow-lg shadow-primary/20">
              Ver carta completa y pedir
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}