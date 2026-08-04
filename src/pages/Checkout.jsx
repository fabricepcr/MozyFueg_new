import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MapPin, Loader2, AlertCircle, CheckCircle, Truck, Store, Clock, Heart, CreditCard, X, ShieldAlert, ChevronRight, Search } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { useToast } from '@/components/ui/use-toast';
import { useStoreSettings } from '@/lib/useStoreSettings';

const RESTAURANT_LAT = 41.4116;
const RESTAURANT_LNG = 2.1751;
const MAX_DELIVERY_KM = 8;

// Caja delimitadora de Barcelona y área metropolitana (minLon,minLat,maxLon,maxLat)
const BCN_BBOX = '1.85,41.28,2.35,41.55';

// Normaliza prefijos de calle en castellano → catalán para mejorar los resultados
// de búsqueda (OSM en Barcelona usa mayoritariamente el nombre en catalán).
function normalizeStreetQuery(input) {
  if (!input) return input;
  let q = ' ' + input.trim() + ' ';
  const map = [
    [/\bcalle\b/gi, 'Carrer'],
    [/\bc\/\s*/gi, 'Carrer '],
    [/\bavenida\b/gi, 'Avinguda'],
    [/\bavda\.?\b/gi, 'Avinguda'],
    [/\bav\.?\b/gi, 'Avinguda'],
    [/\bpaseo\b/gi, 'Passeig'],
    [/\bpº\b/gi, 'Passeig'],
    [/\bplaza\b/gi, 'Plaça'],
    [/\bpza\.?\b/gi, 'Plaça'],
    [/\bpl\.?\b/gi, 'Plaça'],
    [/\bronda\b/gi, 'Ronda'],
    [/\btravesía\b/gi, 'Travessera'],
    [/\btravesia\b/gi, 'Travessera'],
    [/\bpasaje\b/gi, 'Passatge'],
    [/\brambla\b/gi, 'Rambla'],
    [/\bgran vía\b/gi, 'Gran Via'],
    [/\bgran via\b/gi, 'Gran Via'],
  ];
  for (const [re, rep] of map) q = q.replace(re, rep);
  return q.trim();
}

const TIP_OPTIONS = [
  { label: 'Sin propina', value: 0, type: 'fixed' },
  { label: '5%', value: 5, type: 'percent' },
  { label: '10%', value: 10, type: 'percent' },
  { label: '15%', value: 15, type: 'percent' },
  { label: 'Otro', value: 'custom', type: 'custom' },
];

export default function Checkout() {
  const { items, total: subtotal, clearCart } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState('form'); // 'form' | 'confirm'
  const [orderType, setOrderType] = useState('delivery');
  const [form, setForm] = useState({ name: '', phone: '', street: '', floor: '', postalCode: '', pickupTime: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [checkingAddress, setCheckingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [tipOption, setTipOption] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [confirmed, setConfirmed] = useState(false); // casilla de confirmación

  // ─── Autocompletado de direcciones ─────────────────────────────────────────
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const selectedCoordsRef = useRef(null);   // coords elegidas del autocompletado
  const justSelectedRef = useRef(false);     // evita re-buscar tras seleccionar
  const debounceRef = useRef(null);
  const reqIdRef = useRef(0);

  const { data: storeSettings } = useStoreSettings();
  const storeOpen = storeSettings?.store_open !== false;
  const deliveryActive = storeSettings?.delivery_enabled !== false;
  const pickupActive = storeSettings?.pickup_enabled !== false;
  const settingsLoaded = !!storeSettings;

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    if (!deliveryActive && orderType === 'delivery') {
      if (pickupActive) {
        setOrderType('pickup');
        setDeliveryInfo(null);
        setAddressError('');
      }
    }
    if (!pickupActive && orderType === 'pickup') {
      if (deliveryActive) {
        setOrderType('delivery');
      }
    }
  }, [settingsLoaded, deliveryActive, pickupActive]);

  // Dirección que se MUESTRA al cliente (bonita, con piso y CP)
  const displayAddress = `${form.street}${form.floor ? `, ${form.floor}` : ''}${form.postalCode ? ` · CP ${form.postalCode}` : ''}`;
  // Dirección que se GUARDA (limpia y apta para Google Maps del repartidor)
  const storedAddress = `${form.street}${form.postalCode ? `, ${form.postalCode}` : ''}, Barcelona`;

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'street' || field === 'floor') {
      setAddressError('');
      setDeliveryInfo(null);
    }
    if (field === 'street') {
      // El cliente edita la calle a mano → invalidar coords seleccionadas
      selectedCoordsRef.current = null;
    }
  };

  // ─── Buscar sugerencias de calle (Photon / OpenStreetMap) ──────────────────
  const fetchSuggestions = async (query) => {
    const q = normalizeStreetQuery(query);
    if (!q || q.length < 4) { setSuggestions([]); setShowSuggestions(false); return; }
    const myReqId = ++reqIdRef.current;
    setLoadingSuggestions(true);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=default&limit=6&lat=${RESTAURANT_LAT}&lon=${RESTAURANT_LNG}&bbox=${BCN_BBOX}`;
    let features = [];
    try {
      const res = await fetch(url);
      const json = await res.json();
      features = Array.isArray(json?.features) ? json.features : [];
    } catch {
      features = [];
    }
    // Si llegó una respuesta más nueva mientras tanto, descartar esta
    if (myReqId !== reqIdRef.current) return;

    const parsed = features
      .map(f => {
        const p = f.properties || {};
        const coords = f.geometry?.coordinates || [];
        const streetName = p.street || p.name || '';
        const number = p.housenumber || '';
        if (!streetName) return null;
        return {
          streetName,
          number,
          postcode: p.postcode || '',
          city: p.city || p.district || p.locality || '',
          lat: coords[1],
          lng: coords[0],
          line1: [streetName, number].filter(Boolean).join(', '),
          line2: [p.postcode, p.city || p.district || p.locality].filter(Boolean).join(' '),
        };
      })
      .filter(Boolean)
      // Preferimos resultados de la provincia de Barcelona (CP 08xxx) cuando hay CP
      .filter(s => !s.postcode || s.postcode.startsWith('08'));

    setLoadingSuggestions(false);
    setSuggestions(parsed);
    setShowSuggestions(parsed.length > 0);
  };

  // Debounce del input de calle
  useEffect(() => {
    if (orderType !== 'delivery') return;
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const value = form.street;
    if (!value || value.trim().length < 4) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.street, orderType]);

  const handleSelectSuggestion = (s) => {
    const typedNumber = (form.street.match(/\d+/) || [])[0] || '';
    const chosenNumber = s.number || typedNumber;
    const finalStreet = [s.streetName, chosenNumber].filter(Boolean).join(', ');
    justSelectedRef.current = true;
    selectedCoordsRef.current = (isFinite(s.lat) && isFinite(s.lng)) ? { lat: s.lat, lng: s.lng } : null;
    setForm(prev => ({ ...prev, street: finalStreet, postalCode: prev.postalCode || s.postcode || '' }));
    setSuggestions([]);
    setShowSuggestions(false);
    setAddressError('');
    setDeliveryInfo(null);
    // Validar zona con las coordenadas ya conocidas (rápido y exacto)
    setTimeout(() => {
      if (selectedCoordsRef.current) checkDeliveryZone(selectedCoordsRef.current);
    }, 0);
  };

  // ─── Comprobar zona de reparto (distancia REAL por carretera, vía backend) ──
  // Obtiene las coordenadas del destino (del autocompletado o geocodificando con
  // Nominatim) y se las manda al backend, que pregunta a Google la distancia por
  // calle real y decide si entra en los 8 km.
  const checkDeliveryZone = async (coordsArg = null) => {
    if (!form.street.trim()) return null;
    setCheckingAddress(true);
    setAddressError('');

    // Validación rápida de código postal: solo Barcelona (08001–08950)
    if (form.postalCode && form.postalCode.length === 5) {
      const cp = parseInt(form.postalCode, 10);
      if (isNaN(cp) || cp < 8001 || cp > 8950) {
        setCheckingAddress(false);
        setAddressError('El código postal no corresponde a Barcelona. Solo repartimos en la provincia de Barcelona.');
        return null;
      }
    }

    let lat, lon;

    if (coordsArg && isFinite(coordsArg.lat) && isFinite(coordsArg.lng)) {
      // Coordenadas exactas elegidas en el autocompletado
      lat = coordsArg.lat;
      lon = coordsArg.lng;
    } else {
      // Geocodificación (para direcciones escritas a mano sin elegir sugerencia)
      const DEG = 0.35;
      const viewbox = `${RESTAURANT_LNG - DEG},${RESTAURANT_LAT + DEG},${RESTAURANT_LNG + DEG},${RESTAURANT_LAT - DEG}`;
      const normStreet = normalizeStreetQuery(form.street);

      const structuredUrl = `https://nominatim.openstreetmap.org/search?street=${encodeURIComponent(normStreet)}&postalcode=${encodeURIComponent(form.postalCode || '')}&city=Barcelona&country=Espa%C3%B1a&format=json&limit=5&addressdetails=1&viewbox=${viewbox}&bounded=1`;

      let data = [];
      try {
        const res = await fetch(structuredUrl, { headers: { 'Accept-Language': 'es', 'User-Agent': 'MozzarellaYFuego/1.0' } });
        data = await res.json();
      } catch { data = []; }

      if (data.length === 0) {
        const cpPart = form.postalCode?.length === 5 ? ` ${form.postalCode}` : '';
        const q = `${normStreet}${cpPart}, Barcelona, España`;
        const freeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=es&addressdetails=1&viewbox=${viewbox}&bounded=1`;
        try {
          const res = await fetch(freeUrl, { headers: { 'Accept-Language': 'es', 'User-Agent': 'MozzarellaYFuego/1.0' } });
          data = await res.json();
        } catch { data = []; }
      }

      if (data.length === 0) {
        setCheckingAddress(false);
        setAddressError('No pudimos encontrar esa dirección. Empieza a escribir la calle y elígela de la lista para asegurar la ubicación (ej: Carrer de Mallorca, 123).');
        return null;
      }

      const found =
        data.find(r => r.address?.postcode === form.postalCode) ||
        data.find(r => r.address?.postcode?.startsWith('08')) ||
        data[0];

      lat = parseFloat(found.lat);
      lon = parseFloat(found.lon);
    }

    // Preguntar al backend la distancia REAL por carretera (Google Maps).
    let result;
    try {
      const res = await fetch('/api/calcularEnvio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destLat: lat, destLng: lon }),
      });
      result = await res.json();
    } catch {
      setCheckingAddress(false);
      setAddressError('No pudimos calcular la distancia en este momento. Inténtalo de nuevo en unos segundos.');
      return null;
    }

    setCheckingAddress(false);

    if (result?.error) {
      setAddressError('No pudimos calcular la distancia. Revisa la dirección o inténtalo de nuevo.');
      return null;
    }

    if (!result.ok) {
      if (result.reason === 'too_far') {
        setAddressError(`Lo sentimos, solo repartimos hasta ${MAX_DELIVERY_KM} km por carretera. Tu dirección está a ${result.km.toFixed(1)} km del restaurante.`);
      } else if (result.reason === 'no_route') {
        setAddressError('No encontramos una ruta por carretera hasta esa dirección. Revisa que sea correcta.');
      } else {
        setAddressError('Esa dirección está fuera de nuestra zona de reparto.');
      }
      return null;
    }

    const info = { km: result.km, fee: result.fee, estimatedMin: result.estimatedMin };
    setDeliveryInfo(info);
    return info;
  };

  const handleAddressBlur = () => {
    // Pequeño retraso para permitir el click en una sugerencia
    setTimeout(() => setShowSuggestions(false), 150);
    if (orderType === 'delivery' && form.street.trim().length > 5 && !deliveryInfo) {
      if (!/\d/.test(form.street)) {
        setAddressError('Incluye el número de la calle (ej: Carrer de Mallorca, 123).');
        return;
      }
      // Si ya hay coords elegidas, se usan; si no, se geocodifica
      checkDeliveryZone(selectedCoordsRef.current);
    }
  };

  const computeTip = (base) => {
    const opt = TIP_OPTIONS[tipOption];
    if (!opt || opt.value === 0) return 0;
    if (opt.type === 'percent') return parseFloat(((base * opt.value) / 100).toFixed(2));
    if (opt.type === 'custom') return parseFloat(customTip) > 0 ? parseFloat(parseFloat(customTip).toFixed(2)) : 0;
    return 0;
  };

  const handleGoToConfirm = async (e) => {
    e.preventDefault();
    if (items.length === 0) return;

    if (!form.name.trim() || !form.phone.trim()) {
      toast({ title: 'Completa los campos obligatorios', variant: 'destructive' });
      return;
    }
    if (!storeOpen) {
      toast({ title: 'La tienda está cerrada', description: 'No se aceptan pedidos en este momento.', variant: 'destructive' });
      return;
    }
    if (orderType === 'delivery' && !deliveryActive) {
      toast({ title: 'El delivery no está disponible ahora mismo', variant: 'destructive' });
      return;
    }
    if (orderType === 'pickup' && !pickupActive) {
      toast({ title: 'La recogida en local no está disponible ahora mismo', variant: 'destructive' });
      return;
    }
    if (orderType === 'delivery' && !form.street.trim()) {
      toast({ title: 'Introduce la calle y número de entrega', variant: 'destructive' });
      return;
    }
    if (orderType === 'delivery' && !/\d/.test(form.street)) {
      toast({ title: 'La dirección debe incluir el número de calle (ej: Carrer de Mallorca, 123)', variant: 'destructive' });
      return;
    }
    if (orderType === 'pickup' && !form.pickupTime.trim()) {
      toast({ title: 'Indica la hora aproximada de recogida', variant: 'destructive' });
      return;
    }
    if (orderType === 'delivery' && !deliveryInfo) {
      const info = await checkDeliveryZone(selectedCoordsRef.current);
      if (!info) return;
    }

    setStep('confirm');
    setConfirmed(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!confirmed) {
      toast({ title: 'Debes aceptar la política de pedido', variant: 'destructive' });
      return;
    }
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const deliveryFeeToUse = orderType === 'delivery' && deliveryInfo ? deliveryInfo.fee : 0;
    const distanceKm = orderType === 'delivery' && deliveryInfo ? deliveryInfo.km : null;
    const tip = computeTip(subtotal);
    const finalTotal = subtotal + deliveryFeeToUse + tip;

    const orderItems = items.map(i => ({
      menu_item_id: i.id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      removed_ingredients: i.removed_ingredients || [],
    }));

    // El piso/puerta se guarda en las notas para que la dirección quede limpia
    // (así el enlace de Google Maps del repartidor apunta al sitio exacto).
    const combinedNotes = [
      form.notes?.trim(),
      form.floor?.trim() ? `Piso/Puerta: ${form.floor.trim()}` : '',
    ].filter(Boolean).join(' · ');

    const orderData = {
      customer_name: form.name.trim(),
      customer_phone: form.phone.trim(),
      customer_address: orderType === 'delivery' ? storedAddress : '',
      customer_notes: combinedNotes,
      pickup_time: orderType === 'pickup' ? form.pickupTime : '',
      order_type: orderType,
      items: orderItems,
      subtotal,
      delivery_fee: deliveryFeeToUse,
      delivery_distance_km: distanceKm,
      tip,
      total: finalTotal,
      payment_method: 'tarjeta',
      status: 'pending',
    };

    try {
      const res = await fetch('/api/supabaseProxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'insert', table: 'orders', data: orderData }),
      });
      const json = await res.json();
      const result = json?.data;
      if (result?.id) {
        localStorage.setItem('orderId', result.id);
        clearCart();
        navigate(`/seguimiento?orderId=${result.id}`);
      } else {
        throw new Error('Sin ID');
      }
    } catch {
      const localId = `local_${Date.now()}`;
      const localOrder = { ...orderData, id: localId, created_at: new Date().toISOString(), status: 'pending' };
      localStorage.setItem(`order_${localId}`, JSON.stringify(localOrder));
      localStorage.setItem('orderId', localId);
      clearCart();
      navigate(`/seguimiento?orderId=${localId}`);
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background font-body flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-muted-foreground text-lg mb-4">Tu carrito está vacío</p>
          <Link to="/pedir">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl">Ver la carta</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!storeOpen) {
    return (
      <div className="min-h-screen bg-background font-body flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="text-6xl mb-4">🍕</div>
          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Restaurante cerrado</h2>
          <p className="text-muted-foreground mb-6">No estamos aceptando pedidos en este momento. ¡Vuelve pronto!</p>
          <Link to="/">
            <Button variant="outline" className="rounded-xl">Volver al inicio</Button>
          </Link>
        </div>
      </div>
    );
  }

  const deliveryFee = deliveryInfo?.fee ?? null;
  const tipAmount = computeTip(subtotal);
  const finalTotal = subtotal + (orderType === 'delivery' && deliveryFee !== null ? deliveryFee : 0) + tipAmount;

  // ─── PANTALLA DE CONFIRMACIÓN ───────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <div className="min-h-screen bg-background font-body">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => setStep('form')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-heading text-2xl font-bold text-foreground">Confirmar pedido</h1>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-amber-800 text-sm font-medium">
              Una vez confirmado el pedido y comenzada su preparación, no se admitirán cancelaciones ni reembolsos.
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
            <h2 className="font-heading font-semibold mb-3 text-base">Datos de entrega</h2>
            <div className="space-y-1.5 text-sm">
              <p><span className="text-muted-foreground">Nombre:</span> <span className="font-medium">{form.name}</span></p>
              <p><span className="text-muted-foreground">Teléfono:</span> <span className="font-medium">{form.phone}</span></p>
              {orderType === 'delivery' && (
                <p><span className="text-muted-foreground">Dirección:</span> <span className="font-medium">{displayAddress}</span></p>
              )}
              {orderType === 'pickup' && (
                <p><span className="text-muted-foreground">Recogida a las:</span> <span className="font-medium">{form.pickupTime}</span></p>
              )}
              {form.notes && (
                <p><span className="text-muted-foreground">Notas:</span> <span className="font-medium">{form.notes}</span></p>
              )}
              <p><span className="text-muted-foreground">Tipo:</span> <span className="font-medium">{orderType === 'delivery' ? '🛵 Delivery' : '🏠 Recogida en local'}</span></p>
              <p><span className="text-muted-foreground">Pago:</span> <span className="font-medium">💳 Datáfono a domicilio</span></p>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-5 mb-4">
            <h2 className="font-heading font-semibold mb-3 text-base">Productos</h2>
            <div className="space-y-3">
              {items.map(item => (
                <div key={item.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{item.quantity}x {item.name}</span>
                    <span className="text-primary font-semibold">{(item.price * item.quantity).toFixed(2)} €</span>
                  </div>
                  {item.removed_ingredients?.length > 0 && (
                    <p className="text-xs text-red-500 mt-0.5">Quitar: {item.removed_ingredients.map(r => r.replace(/^Sin /, '')).join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span><span>{subtotal.toFixed(2)} €</span>
              </div>
              {orderType === 'delivery' && deliveryFee !== null && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Gastos de envío {deliveryInfo?.km && `(${deliveryInfo.km} km)`}</span>
                  <span>{deliveryFee.toFixed(2)} €</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Propina</span><span>+{tipAmount.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t">
                <span className="font-heading font-bold text-lg">Total</span>
                <span className="font-heading font-bold text-xl text-primary">{finalTotal.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <CreditCard className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-blue-800 font-semibold text-sm">Pago con datáfono a domicilio</p>
              <p className="text-blue-600 text-xs mt-0.5">El repartidor acudirá con un datáfono para realizar el cobro en el momento de la entrega.</p>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer mb-6 p-4 bg-muted/40 rounded-2xl border border-border">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-primary flex-shrink-0"
            />
            <span className="text-sm text-foreground/80 leading-snug">
              Confirmo que los datos del pedido son correctos y acepto la política de no reembolso una vez confirmado el pedido.
            </span>
          </label>

          <Button
            onClick={handleSubmit}
            disabled={submitting || !confirmed}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-6 text-lg disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" />Confirmando pedido...</>
            ) : (
              <><CheckCircle className="w-5 h-5 mr-2" />Confirmar pedido · {finalTotal.toFixed(2)} €</>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ─── FORMULARIO PRINCIPAL ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background font-body">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center gap-4 mb-8">
          <Link to="/pedir" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-heading text-2xl font-bold text-foreground">Tramitar pedido</h1>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800 text-sm font-medium">
            Una vez confirmado el pedido y comenzada su preparación, no se admitirán cancelaciones ni reembolsos.
          </p>
        </div>

        {settingsLoaded && !deliveryActive && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800 text-sm">Delivery no disponible</p>
              <p className="text-orange-600 text-xs mt-0.5">El reparto a domicilio está temporalmente cerrado.</p>
            </div>
          </div>
        )}
        {settingsLoaded && !pickupActive && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-orange-800 text-sm">Recogida en local no disponible</p>
              <p className="text-orange-600 text-xs mt-0.5">La recogida en local está temporalmente cerrada.</p>
            </div>
          </div>
        )}
        {settingsLoaded && !deliveryActive && !pickupActive && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800 text-sm">No hay opciones disponibles</p>
              <p className="text-red-600 text-xs mt-0.5">Tanto el delivery como la recogida están temporalmente cerrados. Disculpa las molestias.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => { if (!deliveryActive) return; setOrderType('delivery'); setDeliveryInfo(null); setAddressError(''); }}
            disabled={!deliveryActive}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${!deliveryActive ? 'border-border bg-muted/40 opacity-60 cursor-not-allowed' : orderType === 'delivery' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
          >
            <Truck className={`w-6 h-6 ${!deliveryActive ? 'text-muted-foreground/50' : orderType === 'delivery' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`font-semibold text-sm ${!deliveryActive ? 'text-muted-foreground/60' : orderType === 'delivery' ? 'text-primary' : 'text-foreground'}`}>Delivery</span>
            <span className="text-xs text-muted-foreground">{deliveryActive ? 'Hasta 60 min' : 'No disponible'}</span>
          </button>
          <button
            type="button"
            onClick={() => { if (!pickupActive) return; setOrderType('pickup'); setDeliveryInfo(null); setAddressError(''); }}
            disabled={!pickupActive}
            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${!pickupActive ? 'border-border bg-muted/40 opacity-60 cursor-not-allowed' : orderType === 'pickup' ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}
          >
            <Store className={`w-6 h-6 ${!pickupActive ? 'text-muted-foreground/50' : orderType === 'pickup' ? 'text-primary' : 'text-muted-foreground'}`} />
            <span className={`font-semibold text-sm ${!pickupActive ? 'text-muted-foreground/60' : orderType === 'pickup' ? 'text-primary' : 'text-foreground'}`}>Recoger en local</span>
            <span className="text-xs text-muted-foreground">{pickupActive ? '15–40 min' : 'No disponible'}</span>
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-5 mb-6">
          <h2 className="font-heading font-semibold mb-4">Resumen del pedido</h2>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id}>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/80">{item.quantity}x {item.name}</span>
                  <span className="font-medium">{(item.price * item.quantity).toFixed(2)} €</span>
                </div>
                {item.removed_ingredients?.length > 0 && (
                  <p className="text-xs text-red-500 mt-0.5">Quitar: {item.removed_ingredients.map(r => r.replace(/^Sin /, '')).join(', ')}</p>
                )}
              </div>
            ))}
          </div>
          <div className="border-t mt-4 pt-4 space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Subtotal</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            {orderType === 'delivery' && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Truck className="w-3.5 h-3.5" /> Gastos de envío
                  {deliveryInfo && <span className="text-xs">({deliveryInfo.km} km)</span>}
                </span>
                <span className={deliveryFee !== null ? 'text-foreground font-medium' : 'text-muted-foreground/50'}>
                  {deliveryFee !== null ? `${deliveryFee.toFixed(2)} €` : '—'}
                </span>
              </div>
            )}
            {tipAmount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-pink-400" /> Propina</span>
                <span className="text-foreground font-medium">+{tipAmount.toFixed(2)} €</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="font-heading font-semibold text-lg">Total</span>
              <span className="font-heading font-bold text-xl text-primary">{finalTotal.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleGoToConfirm} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" placeholder="Tu nombre" value={form.name} onChange={e => updateField('name', e.target.value)} className="rounded-xl mt-1.5" required />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono *</Label>
              <Input id="phone" type="tel" placeholder="Tu número de teléfono" value={form.phone} onChange={e => updateField('phone', e.target.value)} className="rounded-xl mt-1.5" required />
            </div>

            {orderType === 'delivery' && (
              <>
                <div>
                  <Label htmlFor="street">Calle y número *</Label>
                  <div className="relative mt-1.5">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground z-10" />
                    <Input
                      id="street"
                      placeholder="Empieza a escribir: Calle Mallorca, 123..."
                      value={form.street}
                      onChange={e => updateField('street', e.target.value)}
                      onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                      onBlur={handleAddressBlur}
                      className="pl-10 rounded-xl"
                      autoComplete="off"
                      required
                    />
                    {loadingSuggestions && (
                      <Loader2 className="absolute right-3 top-3 w-4 h-4 text-muted-foreground animate-spin" />
                    )}

                    {/* Lista de sugerencias tipo Google Maps */}
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(s); }}
                            className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors flex items-start gap-2 border-b border-border/40 last:border-0"
                          >
                            <Search className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground truncate">{s.line1}</span>
                              {s.line2 && <span className="block text-xs text-muted-foreground truncate">{s.line2}</span>}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Puedes escribir en castellano o catalán. Elige tu calle de la lista para asegurar la ubicación exacta.
                  </p>
                </div>
                <div>
                  <Label htmlFor="floor">Piso / Puerta (opcional)</Label>
                  <Input id="floor" placeholder="Ej: 3º 2ª" value={form.floor} onChange={e => updateField('floor', e.target.value)} className="rounded-xl mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="postalCode">Código postal *</Label>
                  <Input id="postalCode" placeholder="Ej: 08013" value={form.postalCode} onChange={e => updateField('postalCode', e.target.value)} className="rounded-xl mt-1.5" maxLength={5} required />
                </div>

                {checkingAddress && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando dirección y calculando coste...
                  </div>
                )}

                {addressError && (
                  <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/5 border border-destructive/20 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span className="flex-1">{addressError}</span>
                    <button type="button" onClick={() => setAddressError('')} className="p-0.5 hover:opacity-70 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {deliveryInfo && !addressError && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                    <p className="text-green-800 font-semibold text-sm flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" /> Dirección en zona de reparto ✓
                    </p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-green-700 font-bold">{deliveryInfo.km} km</p>
                        <p className="text-green-600 text-xs">Distancia</p>
                      </div>
                      <div>
                        <p className="text-green-700 font-bold">{deliveryInfo.fee.toFixed(2)} €</p>
                        <p className="text-green-600 text-xs">Envío</p>
                      </div>
                      <div>
                        <p className="text-green-700 font-bold">~{deliveryInfo.estimatedMin} min</p>
                        <p className="text-green-600 text-xs">Estimado</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {orderType === 'pickup' && (
              <div>
                <Label htmlFor="pickupTime" className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Hora aproximada de llegada *
                </Label>
                <Input id="pickupTime" type="time" value={form.pickupTime} onChange={e => updateField('pickupTime', e.target.value)} className="rounded-xl mt-1.5" required />
                <p className="text-xs text-muted-foreground mt-1.5">Indica cuándo vendrás a recoger el pedido (15–40 min de preparación)</p>
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notas (opcional)</Label>
              <Textarea id="notes" placeholder="Alergias, instrucciones de entrega, sabores adicionales en pizza..." value={form.notes} onChange={e => updateField('notes', e.target.value)} className="rounded-xl mt-1.5" rows={3} />
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-4 h-4 text-pink-400" />
              <span className="font-heading font-semibold text-sm">¿Quieres dejar propina al repartidor?</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {TIP_OPTIONS.map((opt, i) => (
                <button key={i} type="button" onClick={() => setTipOption(i)} className={`py-2 rounded-xl text-xs font-semibold border-2 transition-all ${tipOption === i ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-border bg-background text-muted-foreground hover:border-pink-300'}`}>
                  {opt.label}
                  {opt.type === 'percent' && tipOption === i && (
                    <div className="text-pink-500 font-bold">+{((subtotal * opt.value) / 100).toFixed(2)}€</div>
                  )}
                </button>
              ))}
            </div>
            {TIP_OPTIONS[tipOption]?.type === 'custom' && (
              <div className="mt-3 flex items-center gap-2">
                <Input type="number" min="0" step="0.50" placeholder="Ej: 2.00" value={customTip} onChange={e => setCustomTip(e.target.value)} className="rounded-xl w-32" />
                <span className="text-sm text-muted-foreground">€</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-heading font-semibold text-blue-800">Pago con datáfono a domicilio</p>
                <p className="text-blue-600 text-sm mt-1">El repartidor acudirá con un datáfono para realizar el cobro en el momento de la entrega.</p>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={checkingAddress || (orderType === 'delivery' && !!addressError)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl py-6 text-lg"
          >
            {checkingAddress ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" />Verificando dirección...</>
            ) : (
              <><ChevronRight className="w-5 h-5 mr-2" />Continuar · {finalTotal.toFixed(2)} €</>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
