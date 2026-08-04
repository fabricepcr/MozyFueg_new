import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, Menu, X, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/CartContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function Navbar() {
  const { itemCount, setIsOpen } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { label: 'Inicio', href: isHome ? '#hero' : '/#hero' },
    { label: 'Nosotros', href: isHome ? '#about' : '/#about' },
    { label: 'Carta', href: isHome ? '#menu' : '/#menu' },
    { label: 'Reseñas', href: isHome ? '#reviews' : '/#reviews' },
    { label: 'Cómo llegar', href: isHome ? '#location' : '/#location' },
  ];

  return (
    <nav aria-label="Navegación principal" className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'bg-background/95 backdrop-blur-md shadow-sm' : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <a href={isHome ? '#hero' : '/'} className="flex items-center gap-2" aria-label="Mozzarella y Fuego - Ir a inicio">
            <img 
              src="https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/12855c20b_063377eb-48ed-42cd-ac81-248bd227eeb4-u1_f540b13d-dede-4bf5-96c4-dbf828a98247.png" 
              alt="Logo Mozzarella y Fuego, pizzería brasileña Barcelona" 
              className="w-10 h-10 object-contain"
              width="40"
              height="40"
            />
            <span className={`font-heading font-bold text-lg sm:text-xl transition-colors ${
              scrolled ? 'text-foreground' : 'text-white'
            }`}>
              Mozzarella y Fuego
            </span>
          </a>

          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  scrolled ? 'text-foreground/70' : 'text-white/80 hover:text-white'
                }`}
              >
                {link.label}
              </a>
            ))}
            <Link
              to="/reservas"
              className={`text-sm font-semibold transition-colors px-3 py-1.5 rounded-full border ${
                scrolled
                  ? 'border-primary text-primary hover:bg-primary hover:text-primary-foreground'
                  : 'border-white/60 text-white hover:bg-white/10'
              }`}
            >
              Reservas
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <a href="tel:640325113" className="hidden sm:flex">
              <Button variant="ghost" size="sm" className={`gap-2 ${scrolled ? '' : 'text-white hover:bg-white/10'}`}>
                <Phone className="w-4 h-4" />
                <span className="text-sm">Llamar</span>
              </Button>
            </a>
            
            <Link to="/pedir">
              <Button 
                size="sm" 
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 relative"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">Pedir</span>
                {itemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>

            <button
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className={`w-6 h-6 ${scrolled ? 'text-foreground' : 'text-white'}`} />
              ) : (
                <Menu className={`w-6 h-6 ${scrolled ? 'text-foreground' : 'text-white'}`} />
              )}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-background/95 backdrop-blur-md border-t"
          >
            <div className="px-4 py-4 space-y-3">
              {navLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-foreground/80 hover:text-primary font-medium py-2"
                >
                  {link.label}
                </a>
              ))}
              <Link to="/reservas" onClick={() => setMobileOpen(false)} className="block text-primary font-semibold py-2">
                Reservas
              </Link>
              <a href="tel:640325113" className="block text-primary font-medium py-2">
                640 325 113
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}