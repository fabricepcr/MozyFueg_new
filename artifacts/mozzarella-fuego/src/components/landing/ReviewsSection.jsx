import React from 'react';
import { motion } from 'framer-motion';
import { Star, ExternalLink } from 'lucide-react';

const GOOGLE_MAPS_URL = "https://www.google.com/maps/place/Mozzarella+y+Fuego/@41.4116588,2.1748261,17z/data=!4m8!3m7!1s0x12a4a30004589a85:0x1d696d8c74f6a8c2!8m2!3d41.4116588!4d2.1751455!9m1!1b1!16s%2Fg%2F11mstj_ynm?authuser=0&entry=ttu&g_ep=EgoyMDI2MDUxMC4wIKXMDSoASAFQAw%3D%3D";

const reviews = [
  {
    name: 'Anderson Serqueira',
    text: 'Me encantó en saber que encontré una pizzeria al estilo brasileño. Las pizzas son muy ricas.',
    rating: 5,
    initials: 'AS',
    color: 'bg-orange-100 text-orange-700',
  },
  {
    name: 'Glenn Urdaneta',
    text: 'Muy ricas pizzas brasileñas y muy buena atención.',
    rating: 5,
    initials: 'GU',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    name: 'Veronica Barretto',
    text: 'Todo perfecto. Seguro que volveré. Hacía muchos años que no comía una pizza tan rica. Estoy encantada.',
    rating: 5,
    initials: 'VB',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    name: 'Carolina Basso',
    text: 'Fuimos al rodízio de pizza por la noche. La calidad de las pizzas estupenda y hay mucha variedad. El atendimiento rápido y eficiente. Relación calidad-precio perfecto. 100% recomendable!',
    rating: 5,
    initials: 'CB',
    color: 'bg-teal-100 text-teal-700',
  },
  {
    name: 'Wander Watson',
    text: 'Si echas de menos una buena pizza brasileña, este es el sitio: pizzas bien cargadas y con la masa igualita a la de Brasil. 10/10.',
    rating: 5,
    initials: 'WW',
    color: 'bg-yellow-100 text-yellow-700',
  },
  {
    name: 'Vando Viera',
    text: 'Lugar maravilloso, pizzas simplemente deliciosas, bebidas espectaculares, servicio perfecto.',
    rating: 5,
    initials: 'VV',
    color: 'bg-primary/10 text-primary',
  },
];

function StarRating({ rating }) {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className={`w-4 h-4 ${i < rating ? 'fill-accent text-accent' : 'text-muted'}`} />
      ))}
    </div>
  );
}

export default function ReviewsSection() {
  return (
    <section id="reviews" className="py-20 sm:py-28 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-primary font-medium text-sm tracking-[0.2em] uppercase mb-3">Reseñas reales</p>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Lo que dicen <span className="text-primary italic">nuestros clientes</span> sobre la mejor pizzería brasileña de Barcelona
          </h2>

          {/* Rating summary */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-6 h-6 fill-accent text-accent" />
              ))}
            </div>
            <span className="font-heading text-4xl font-bold text-foreground">5.0</span>
            <span className="text-muted-foreground text-sm">en Google</span>
          </div>

          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:text-primary/80 font-medium transition-colors underline underline-offset-4"
          >
            Ver todas las reseñas en Google
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review, i) => (
            <motion.a
              key={review.name}
              href={GOOGLE_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group bg-card rounded-2xl p-6 border border-border/50 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer block"
            >
              {/* Stars + Google badge */}
              <div className="flex items-center justify-between mb-4">
                <StarRating rating={review.rating} />
                <div className="flex items-center gap-1 opacity-50 group-hover:opacity-80 transition-opacity">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
              </div>

              {/* Review text */}
              <p className="text-foreground/80 leading-relaxed text-sm flex-1">
                "{review.text}"
              </p>

              {/* Author */}
              <div className="mt-5 pt-4 border-t border-border/50 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${review.color}`}>
                  {review.initials}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{review.name}</p>
                  <p className="text-xs text-muted-foreground">Reseña en Google</p>
                </div>
              </div>
            </motion.a>
          ))}
        </div>

        {/* CTA button */}
        <div className="text-center mt-12">
          <a
            href={GOOGLE_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-primary text-primary hover:bg-primary hover:text-primary-foreground font-medium text-sm transition-all duration-200"
          >
            <ExternalLink className="w-4 h-4" />
            Déjanos tu reseña en Google
          </a>
        </div>

      </div>
    </section>
  );
}