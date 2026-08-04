import React from 'react';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Clock, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';

// Carrer de Sant Antoni Maria Claret 278, Eixample, Barcelona
const LAT = 41.4116;
const LNG = 2.1751;

export default function LocationSection() {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${LAT},${LNG}`;

  return (
    <section id="location" className="py-20 sm:py-28 bg-secondary/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-16">
          <p className="text-primary font-medium text-sm tracking-[0.2em] uppercase mb-3">Encuéntranos</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Cómo <span className="text-primary italic">llegar</span> a Mozzarella y Fuego
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Nos encontramos en el corazón del Eixample de Barcelona. Ven a probar la auténtica <strong className="text-foreground">pizza brasileña en Barcelona</strong>.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="lg:col-span-3 rounded-2xl overflow-hidden shadow-xl h-[350px] sm:h-[450px]">
            
            <MapContainer center={[LAT, LNG]} zoom={15} style={{ width: '100%', height: '100%' }} scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              
              <Marker position={[LAT, LNG]}>
                <Popup>
                  <strong>Mozzarella y Fuego</strong><br />
                  Carrer de Sant Antoni Maria Claret 278
                  </Popup>
              </Marker>
              <Circle center={[LAT, LNG]} radius={8000} pathOptions={{ color: 'hsl(10, 70%, 45%)', fillColor: 'hsl(10, 70%, 45%)', fillOpacity: 0.05, weight: 1 }} />
            </MapContainer>
          </motion.div>

          {/* Info cards */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-background rounded-2xl p-6 border border-border/50 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-1">Dirección</h3>
                  <p className="text-muted-foreground text-sm">Carrer de Sant Antoni Maria Claret 238
Eixample, 08025, Barcelona

                  </p>
                </div>
              </div>
            </div>

            <div className="bg-background rounded-2xl p-6 border border-border/50 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-1">Horario</h3>
                  <p className="text-muted-foreground text-sm">
                    Martes a Domingo: 18:00 – 00:00<br />
                    Rodízio: Vie/Sáb/Dom 19–21 | 21:30–23:30
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-background rounded-2xl p-6 border border-border/50 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-foreground mb-1">Contacto</h3>
                  <a href="tel:640325113" className="text-primary font-semibold text-lg hover:underline">
                    640 325 113
                  </a>
                  <p className="text-muted-foreground text-sm mt-1">Llama o escríbenos por WhatsApp</p>
                </div>
              </div>
            </div>

            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="block">
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-6 text-lg gap-2 shadow-lg">
                <Navigation className="w-5 h-5" />
                Abrir ruta en Google Maps
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>);

}