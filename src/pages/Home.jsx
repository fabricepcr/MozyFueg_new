import React from 'react';
import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import AboutSection from '@/components/landing/AboutSection';
import ServicesSection from '@/components/landing/ServicesSection';
import MenuPreview from '@/components/landing/MenuPreview';
import MultiFlavorsSection from '@/components/landing/MultiFlavorsSection';
import ReviewsSection from '@/components/landing/ReviewsSection';
import LocationSection from '@/components/landing/LocationSection';
import Footer from '@/components/landing/Footer';

export default function Home() {
  return (
    <div className="font-body">
      <Navbar />
      <HeroSection />
      <AboutSection />
      <ServicesSection />
      <MenuPreview />
      <MultiFlavorsSection />
      <ReviewsSection />
      <LocationSection />
      <Footer />
    </div>
  );
}