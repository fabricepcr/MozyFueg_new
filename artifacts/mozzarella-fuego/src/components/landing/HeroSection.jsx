import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronDown, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

const HERO_IMAGE = 'https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/fc2bf3869_e5eaa7af-3491-4f5f-a85e-b00a047b0a6b.jpg';

export default function HeroSection() {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={HERO_IMAGE}
          alt="Pizzas artesanales brasileñas de Mozzarella y Fuego, pizzería brasileña en Barcelona Eixample"
          className="w-full h-full object-cover"
          fetchpriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <p className="text-white/70 font-body text-sm sm:text-base tracking-[0.3em] uppercase mb-4">
            Pizzería brasileña en Barcelona · Eixample
          </p>
          <h1 className="font-heading text-5xl sm:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight">
            Mozzarella<br />
            <span className="text-accent italic">y Fuego</span>
          </h1>
          <p className="text-white/80 font-body text-lg sm:text-xl mb-2 max-w-2xl mx-auto">
            Auténticas pizzas brasileñas artesanales en Barcelona — pizzas saladas, dulces y rodízio
          </p>
          <div className="flex items-center justify-center gap-2 text-white/60 text-sm mb-10">
            <MapPin className="w-4 h-4" aria-hidden="true" />
            <address className="not-italic text-white/60 text-sm">
              Carrer de Sant Antoni Maria Claret 238, Eixample, Barcelona
            </address>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/pedir">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-10 py-6 rounded-full shadow-2xl shadow-primary/30">
              Pedir ahora
            </Button>
          </Link>
          <a href="tel:640325113">
            <Button size="lg" variant="outline" className="text-white border-white/30 hover:bg-white/10 text-lg px-10 py-6 rounded-full backdrop-blur-sm">
              Llamar al local
            </Button>
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        <ChevronDown className="w-6 h-6 text-white/40" />
      </motion.div>
    </section>
  );
}