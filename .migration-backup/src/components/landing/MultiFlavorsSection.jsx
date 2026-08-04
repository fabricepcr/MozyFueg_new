import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export default function MultiFlavorsSection() {
  return (
    <section className="py-16 px-4 bg-background">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10">
          
          <p className="text-primary font-medium text-sm tracking-widest uppercase mb-3">Personaliza tu pizza</p>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Pizzas con varios sabores
          </h2>
          <p className="text-muted-foreground">¿No puedes decidirte? Combina hasta varios sabores en una misma pizza.</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl border border-border/50 p-6 text-center">
            
            <h3 className="font-heading font-bold text-2xl mb-1">Pizza 24 cm</h3>
            <p className="text-4xl font-bold text-primary mb-2">2 sabores</p>
            <p className="text-muted-foreground text-sm">Hasta dos sabores distintos en tu pizza individual (24 cm)</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl border border-border/50 p-6 text-center">
            
            <h3 className="font-heading font-bold text-2xl mb-1">Pizza 33 cm</h3>
            <p className="text-4xl font-bold text-primary mb-2">4 sabores</p>
            <p className="text-muted-foreground text-sm">Hasta cuatro sabores distintos en tu pizza grande</p>
          </motion.div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
            <p className="font-semibold text-green-800 mb-2">Precio justo</p>
            <p className="text-green-700 text-sm">El precio final siempre será el del sabor más caro. Selecciona ese en el pedido.</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <p className="font-semibold text-blue-800 mb-2">¿Cómo indicarlo?</p>
            <p className="text-blue-700 text-sm">Selecciona el sabor más caro entre los sabores elegidos y añade los demás sabores en el campo de notas del pedido.</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 flex items-start gap-4">
          
          <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="font-bold text-amber-900 text-lg mb-1">Aviso importante</p>
            <p className="text-amber-800">No se pueden mezclar sabores dulces y salados en la misma pizza.</p>
          </div>
        </motion.div>
      </div>
    </section>);

}