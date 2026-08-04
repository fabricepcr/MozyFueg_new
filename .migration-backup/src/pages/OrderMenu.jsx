import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { fetchMenuItems } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import MenuItemCard from '@/components/order/MenuItemCard';
import CategoryTabs from '@/components/order/CategoryTabs';
import FloatingCart from '@/components/order/FloatingCart';
import CartDrawer from '@/components/order/CartDrawer';
import { useStoreSettings } from '@/lib/useStoreSettings';

export default function OrderMenu() {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ['menuItems'],
    queryFn: fetchMenuItems,
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // refresca la disponibilidad cada minuto
  });

  const { data: storeSettings } = useStoreSettings();

  const storeOpen = storeSettings?.store_open !== false;
  const deliveryActive = storeSettings?.delivery_enabled !== false;
  const pickupActive = storeSettings?.pickup_enabled !== false;

  const processedItems = useMemo(() => {
    const pizzaMap = new Map();
    const others = [];

    const pizzaItems = [];
    menuItems.forEach(item => {
      const cat = item.category;
      if (cat === 'pizzas' || cat === 'pizzas_dulces') {
        pizzaItems.push(item);
      } else {
        // Productos sin tamaños: la disponibilidad es directa.
        others.push({ ...item, available: item.available !== false });
      }
    });

    // Las pizzas vienen como 2 filas (23cm y 33cm) que aquí se fusionan en una
    // tarjeta. Hay que fusionar TAMBIÉN la disponibilidad de cada tamaño.
    pizzaItems.forEach(item => {
      const key = `${item.category}__${item.name}`;
      const isOn = item.available !== false;

      if (!pizzaMap.has(key)) {
        pizzaMap.set(key, {
          ...item,
          _variants: [{ price: item.price, available: isOn }],
        });
      } else {
        const existing = pizzaMap.get(key);
        existing._variants.push({ price: item.price, available: isOn });

        const prices = [existing.price, item.price].sort((a, b) => a - b);
        existing.price_23cm = prices[0];
        existing.price = prices[1];

        if (!existing.image_url && item.image_url) existing.image_url = item.image_url;
      }
    });

    // Calcular la disponibilidad final por tamaño (el barato = 23cm, el caro = 33cm)
    pizzaMap.forEach(p => {
      const variants = p._variants || [];
      if (variants.length > 1) {
        const sorted = [...variants].sort((a, b) => a.price - b.price);
        p.available_23cm = sorted[0].available;
        p.available_33cm = sorted[sorted.length - 1].available;
      } else {
        // Pizza con un solo tamaño
        p.available_23cm = variants[0]?.available ?? true;
        p.available_33cm = variants[0]?.available ?? true;
      }
      // La tarjeta está disponible si al menos un tamaño lo está.
      p.available = p.available_23cm || p.available_33cm;
      delete p._variants;
    });

    const categoryOrder = { pizzas: 0, pizzas_dulces: 1, bebidas: 2 };
    return [...Array.from(pizzaMap.values()), ...others].sort((a, b) => {
      const catDiff = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
      if (catDiff !== 0) return catDiff;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [menuItems]);

  const filteredItems = processedItems.filter(item => {
    const matchesCategory = category === 'all' || item.category === category;
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Los agotados se muestran, pero al FINAL de la lista y en gris.
  const sortedItems = useMemo(() => {
    return [...filteredItems].sort((a, b) => {
      const aOut = a.available === false ? 1 : 0;
      const bOut = b.available === false ? 1 : 0;
      return aOut - bOut;
    });
  }, [filteredItems]);

  const soldOutCount = processedItems.filter(i => i.available === false).length;

  return (
    <div className="min-h-screen bg-background font-body">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-heading text-2xl font-bold text-foreground">Nuestra Carta</h1>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar en la carta..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 rounded-xl bg-muted border-0"
            />
          </div>

          <CategoryTabs active={category} onChange={handleCategoryChange} />
        </div>
      </div>

      {!storeOpen && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Restaurante cerrado</p>
              <p className="text-red-600 text-sm mt-0.5">No estamos aceptando pedidos en este momento. Vuelve pronto.</p>
            </div>
          </div>
        </div>
      )}

      {storeOpen && !deliveryActive && pickupActive && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800">Delivery no disponible</p>
              <p className="text-orange-600 text-sm mt-0.5">El delivery está desactivado temporalmente. Puedes pedir para <strong>recoger en el local</strong>.</p>
            </div>
          </div>
        </div>
      )}
      {storeOpen && deliveryActive && !pickupActive && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800">Recogida en local no disponible</p>
              <p className="text-orange-600 text-sm mt-0.5">La recogida en local está desactivada temporalmente. Solo disponible <strong>delivery a domicilio</strong>.</p>
            </div>
          </div>
        </div>
      )}
      {storeOpen && !deliveryActive && !pickupActive && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Sin servicio disponible</p>
              <p className="text-red-600 text-sm mt-0.5">Tanto el delivery como la recogida están temporalmente cerrados. Disculpa las molestias.</p>
            </div>
          </div>
        </div>
      )}

      {/* Aviso de productos agotados */}
      {storeOpen && soldOutCount > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800 text-sm">
                {soldOutCount === 1
                  ? 'Hay 1 producto agotado'
                  : `Hay ${soldOutCount} productos agotados`}
              </p>
              <p className="text-slate-600 text-xs mt-0.5">
                Aparecen marcados como <strong>Agotado</strong> y no se pueden añadir al carrito.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🍕</span>
          <div>
            <p className="font-semibold text-amber-900 text-sm">¿Quieres pizzas de varios sabores?</p>
            <p className="text-amber-700 text-xs mt-0.5">Selecciona el sabor más caro entre los que quieras y añade los demás sabores en el campo de <strong>notas del pedido</strong>. ¡Así podemos preparar tu pizza a medida!</p>
            <p className="text-amber-700 text-xs mt-1">🍕 <strong>Pizza 24cm:</strong> máximo 2 sabores · <strong>Pizza 33cm:</strong> máximo 4 sabores.</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6" style={{ paddingBottom: 'max(8rem, calc(6rem + env(safe-area-inset-bottom)))' }}>
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-muted rounded-xl h-64 animate-pulse" />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg">No se encontraron productos</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Prueba con otra búsqueda o categoría</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedItems.map(item => (
              <MenuItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <FloatingCart storeOpen={storeOpen} />
      <CartDrawer storeOpen={storeOpen} />
    </div>
  );
}
