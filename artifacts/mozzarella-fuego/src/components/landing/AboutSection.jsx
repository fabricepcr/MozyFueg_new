import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Heart, Leaf } from 'lucide-react';

const INTERIOR_IMAGE = 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/25007bad4_generated_09011327.png';

export default function AboutSection() {
  const features = [
  { icon: Heart, title: 'Sabor Barcelona', desc: 'Recetas auténticas con el sabor de la ciudad' },
  { icon: Leaf, title: 'Producto fresco', desc: 'Ingredientes seleccionados cada día' }];


  return (
    <section id="about" className="py-20 sm:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="relative">
            
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              <img src="https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/f5acc780c_18fb5d9d-4e83-43f5-b876-35df2147d7a0.jpg"
              alt="Interior del restaurante Mozzarella y Fuego, pizzería brasileña en el Eixample de Barcelona"
              loading="lazy"
              decoding="async"
              width="600"
              height="500"
              className="w-full h-[400px] sm:h-[500px] object-cover rounded-none opacity-100" />
              
            </div>
            <div className="absolute -bottom-6 -right-6 bg-primary text-primary-foreground rounded-2xl p-6 shadow-xl hidden sm:block">
              <p className="font-heading text-3xl font-bold">5.0</p>
              <div className="flex gap-1 mt-1">
                {[...Array(5)].map((_, i) =>
                <span key={i} className="text-accent text-lg">★</span>
                )}
              </div>
              <p className="text-sm text-primary-foreground/70 mt-1">Google Reviews</p>
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}>
            
            <p className="text-primary font-medium text-sm tracking-[0.2em] uppercase mb-3">Sobre nosotros</p>
            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              El auténtico sabor<br />
              <span className="text-primary italic">de Brasil</span> en Barcelona
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-8">
              En <strong className="text-foreground">Mozzarella y Fuego</strong>, la mejor <strong className="text-foreground">pizzería brasileña de Barcelona</strong>, traemos la tradición pizzera de Brasil al corazón del Eixample. 
              Nuestras <strong className="text-foreground">pizzas artesanales Barcelona</strong> se preparan con masa artesanal, ingredientes frescos y recetas que combinan los 
              sabores más icónicos: catupiry, calabresa, picaña, strogonoff y mucho más.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-10">
              También ofrecemos <strong className="text-foreground">rodizio de pizza en Barcelona</strong> los viernes, sábados y domingos: un buffet libre donde nuestros camareros pasan por tu mesa con pizzas recién hechas. 
              Ven a descubrir por qué nuestros clientes nos dan 5 estrellas en Google.
            </p>

            <div className="grid sm:grid-cols-3 gap-6">
              {features.map(({ icon: Icon, title, desc }) =>
              <div key={title} className="text-center sm:text-left">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3 mx-auto sm:mx-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </section>);

}