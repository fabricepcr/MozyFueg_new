import React from 'react';
import { Phone, MapPin, Instagram } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-foreground text-background py-12" aria-label="Información del restaurante">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid sm:grid-cols-3 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <img 
                src="https://media.base44.com/images/public/69fe6a7e200b264bdf26cda6/12855c20b_063377eb-48ed-42cd-ac81-248bd227eeb4-u1_f540b13d-dede-4bf5-96c4-dbf828a98247.png" 
                alt="Logo Mozzarella y Fuego, pizzería brasileña en Barcelona"
                width="40"
                height="40"
                loading="lazy"
                className="w-10 h-10 object-contain"
              />
              <h3 className="font-heading text-2xl font-bold">Mozzarella y Fuego</h3>
            </div>
            <p className="text-background/60 text-sm">
              <strong className="text-background/80">Pizzería brasileña en Barcelona</strong>. Pizzas artesanales saladas, dulces y rodízio 
              en el corazón del Eixample.
            </p>
            <div className="mt-3 space-y-1 text-xs text-background/50">
              <p>🕐 Mar–Dom: 18:00 – 00:00</p>
              <p>🍕 Rodízio: Vie/Sáb/Dom 19:00–21:00 y 21:30–23:30</p>
            </div>
          </div>

          <div>
            <h4 className="font-heading font-semibold mb-3">Contacto y dirección</h4>
            <address className="not-italic space-y-2 text-sm text-background/70">
              <a href="tel:+34640325113" className="flex items-center gap-2 hover:text-background transition-colors">
                <Phone className="w-4 h-4" aria-hidden="true" /> 640 325 113
              </a>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>C/ Sant Antoni Maria Claret 238, 08025 Barcelona</span>
              </div>
              <a
                href="https://www.google.com/maps/dir/?api=1&destination=41.4109,2.1747"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-background transition-colors text-background/60"
              >
                Ver en Google Maps →
              </a>
            </address>
          </div>

          <div>
            <h4 className="font-heading font-semibold mb-3">Síguenos</h4>
            <a
              href="https://www.instagram.com/mozzarella_y_fuego/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Síguenos en Instagram @mozzarella_y_fuego"
              className="inline-flex items-center gap-2 text-sm text-background/70 hover:text-background transition-colors"
            >
              <Instagram className="w-5 h-5" aria-hidden="true" /> @mozzarella_y_fuego
            </a>
            <div className="mt-4 space-y-1 text-xs text-background/50">
              <p><a href="/pedir" className="hover:text-background transition-colors">Pedir online →</a></p>
              <p><a href="/reservas" className="hover:text-background transition-colors">Hacer una reserva →</a></p>
            </div>
          </div>
        </div>

        <div className="border-t border-background/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-background/40">
          <span>© {new Date().getFullYear()} Mozzarella y Fuego · Pizzería Brasileña Barcelona</span>
          <span>Eixample · Barcelona · España</span>
        </div>
      </div>
    </footer>
  );
}