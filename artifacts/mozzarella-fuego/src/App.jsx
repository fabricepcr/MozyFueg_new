import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { CartProvider } from '@/lib/CartContext';
import Home from '@/pages/Home';
import OrderMenu from '@/pages/OrderMenu';
import Checkout from '@/pages/Checkout.jsx';
import AdminOrders from '@/pages/AdminOrders';
import DriverView from '@/pages/DriverView';
import TrackOrder from '@/pages/TrackOrder';
import OrderConfirmed from '@/pages/OrderConfirmed';
import Reservations from '@/pages/Reservations';
import ReservationPolicy from '@/pages/ReservationPolicy';

const AuthenticatedApp = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pedir" element={<OrderMenu />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/admin" element={<AdminOrders />} />
      <Route path="/admin/pedidos" element={<AdminOrders />} />
      <Route path="/repartidor" element={<DriverView />} />
      <Route path="/seguimiento" element={<TrackOrder />} />
      <Route path="/pedido-confirmado" element={<OrderConfirmed />} />
      <Route path="/reservas" element={<Reservations />} />
      <Route path="/politica-reservas" element={<ReservationPolicy />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <CartProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </CartProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App