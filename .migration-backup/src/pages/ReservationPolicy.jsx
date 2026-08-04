import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

export default function ReservationPolicy() {
  return (
    <div className="font-body">
      <Navbar />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-foreground text-background py-16 px-6">
          <div className="max-w-2xl mx-auto">
            <Link to="/reservas" className="inline-flex items-center gap-2 text-background/60 hover:text-background transition-colors mb-6 text-sm">
              <ArrowLeft className="w-4 h-4" /> Volver a reservas
            </Link>
            <p className="text-accent font-medium text-sm tracking-widest uppercase mb-3">
              Mozzarella y Fuego
            </p>
            <h1 className="font-heading text-4xl sm:text-5xl font-bold mb-4">
              Política de Reservas
            </h1>
            <p className="text-background/70 text-lg">
              Con el fin de garantizar una experiencia de calidad y una adecuada organización del servicio, le informamos a continuación de las condiciones aplicables a las reservas en nuestro establecimiento.
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-10">

          {/* Rodizio */}
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">1. Reservas para Rodízio / Buffet Libre</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>El servicio de rodízio está disponible los <strong className="text-foreground">viernes, sábados y domingos</strong>, organizado en dos turnos:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong className="text-foreground">Primer turno:</strong> 19:00 – 21:00 h</li>
                <li><strong className="text-foreground">Segundo turno:</strong> 21:30 – 23:30 h</li>
              </ul>
              <p>Las reservas realizadas para estos días y franjas horarias corresponden <strong className="text-foreground">exclusivamente al servicio de rodízio</strong>. No se admitirá el cambio a servicio a la carta una vez efectuada la reserva.</p>
            </div>
          </div>

          {/* Precios rodizio */}
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">2. Tarifas del Rodízio</h2>
            <div className="space-y-2 text-muted-foreground">
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span>Adultos y niños mayores de 11 años</span>
                <span className="font-bold text-foreground">25,00 €</span>
              </div>
              <div className="flex justify-between items-center py-2.5 border-b border-border/50">
                <span>Niños de 4 a 10 años</span>
                <span className="font-bold text-foreground">12,50 €</span>
              </div>
              <div className="flex justify-between items-center py-2.5">
                <span>Niños de hasta 3 años</span>
                <span className="font-bold text-foreground">Sin cargo</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">Las bebidas no están incluidas en el precio y se facturarán por separado. El servicio es individual y se aplica de forma uniforme a todos los comensales de la mesa, quienes deberán solicitar el mismo tipo de servicio.</p>
          </div>

          {/* A la carta */}
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">3. Reservas a la Carta</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>De <strong className="text-foreground">martes a jueves</strong>, aceptamos reservas anticipadas para el servicio a la carta sin restricción de horario.</p>
              <p>Los <strong className="text-foreground">viernes, sábados y domingos</strong>, el servicio a la carta estará condicionado a la disponibilidad de mesas una vez atendidas las reservas del rodízio. En tal caso, las reservas para servicio a la carta únicamente se aceptarán <strong className="text-foreground">a partir de las 18:00 h del mismo día</strong>.</p>
            </div>
          </div>

          {/* Puntualidad */}
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">4. Puntualidad</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>Se establece una tolerancia máxima de <strong className="text-foreground">15 minutos</strong> sobre la hora acordada. Transcurrido dicho período sin que el cliente se haya presentado ni haya notificado un retraso, el establecimiento no podrá garantizar la disponibilidad de la mesa reservada.</p>
            </div>
          </div>

          {/* Cancelaciones */}
          <div>
            <h2 className="font-heading text-xl font-bold text-foreground mb-4 pb-2 border-b border-border">5. Cancelaciones y No Presentaciones</h2>
            <div className="space-y-3 text-muted-foreground leading-relaxed">
              <p>En caso de no poder asistir, le rogamos que comunique la cancelación con una <strong className="text-foreground">antelación mínima de 8 horas</strong> respecto a la hora de la reserva.</p>
              <p>Dado que el servicio de rodízio requiere una planificación y preparación previas en función del número de comensales confirmados, las cancelaciones de última hora y las no presentaciones generan un perjuicio directo para el funcionamiento del establecimiento, así como un incremento innecesario del desperdicio alimentario.</p>
              <p>La comunicación a tiempo de cualquier cambio o cancelación contribuye, además, a que otros clientes en lista de espera puedan disfrutar del servicio.</p>
              <p>Agradecemos su colaboración y comprensión.</p>
            </div>
          </div>

          <div className="border-t border-border pt-8 pb-10 text-center">
            <p className="text-sm text-muted-foreground mb-6">Si tiene alguna consulta relacionada con su reserva, no dude en contactarnos directamente.</p>
            <Link to="/reservas">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 py-5 text-base">
                Solicitar reserva
              </Button>
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}