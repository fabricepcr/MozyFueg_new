import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MapPin, Loader2, AlertCircle, CheckCircle, Truck, Store, Clock, Heart, CreditCard, X, ShieldAlert, ChevronRight, Search, Calendar, Banknote } from 'lucide-react';
import { useCart } from '@/lib/CartContext';
import { useToast } from '@/components/ui/use-toast';
import { useStoreSettings } from '@/lib/useStoreSettings';

// ── Opening-hours validation ─────────────────────────────────────────────────
const DAY_KEY  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DAY_ES   = ['domingos','lunes','martes','miércoles','jueves','viernes','sábados'];

function validateScheduledTime(dateStr, timeStr, schedule) {
  if (!dateStr || !timeStr || !schedule) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();          // 0=Sun … 6=Sat (local)
  const dayKey = DAY_KEY[dow];
  const dayEs  = DAY_ES[dow];
  const daySched = schedule[dayKey];

  if (!daySched?.enabled) {
    return `No abrimos los ${dayEs}. Elige otro día.`;
  }
  const slots = daySched.slots || [];
  const ok = slots.some(s => s.open <= timeStr && timeStr <= s.close);
  if (!ok) {
    const hrs = slots.map(s => `${s.open}–${s.close}`).join(', ');
    return `Fuera de nuestro horario. Los ${dayEs} abrimos de ${hrs}.`;
  }
  return null;
}

const MAX_DELIVERY_KM = 8;

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
  const [form, setForm] = useState({ name: '', phone: '', street: '', floor: '', postalCode: '', pickupTime: '', scheduledDate: '', scheduledTime: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [checkingAddress, setCheckingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [tipOption, setTipOption] = useState(0);
  const [customTip, setCustomTip] = useState('');
  const [confirmed, setConfirmed] = useState(false); // casilla de confirmación
  const [paymentMethod, setPaymentMethod] = useState('card'); // 'card' | 'cash'
  const [scheduleOrder, setScheduleOrder] = useState(false);

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

  // Fetch opening-hours schedule (no auth needed)
  const { data: deliverySettings } = useQuery({
    queryKey: ['deliverySettings'],
    queryFn: async () => {
      const res = await fetch('/api/adminSettings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getDeliverySettings' }),
      });
      const d = await res.json();
      return d?.data ?? null;
    },
    staleTime: 60_000,
  });

  const scheduleError = useMemo(
    () => scheduleOrder
      ? validateScheduledTime(form.scheduledDate, form.scheduledTime, deliverySettings?.schedule)
      : null,
    [scheduleOrder, form.scheduledDate, form.scheduledTime, deliverySettings],
  );
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

  // ─── Buscar sugerencias de calle (Google Places Autocomplete, vía backend) ──
  const fetchSuggestions = async (query) => {
    if (!query || query.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    const myReqId = ++reqIdRef.current;
    setLoadingSuggestions(true);
    let predictions = [];
    try {
      const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      predictions = data.predictions || [];
    } catch { predictions = []; }
    if (myReqId !== reqIdRef.current) return;
    const parsed = predictions.map(p => ({
      placeId: p.place_id,
      line1: p.structured_formatting?.main_text || p.description,
      line2: p.structured_formatting?.secondary_text || '',
    }));
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
    if (!value || value.trim().length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [form.street, orderType]);

  const handleSelectSuggestion = async (s) => {
    justSelectedRef.current = true;
    setSuggestions([]);
    setShowSuggestions(false);
    setAddressError('');
    setDeliveryInfo(null);
    selectedCoordsRef.current = null;
    setForm(prev => ({ ...prev, street: s.line1 }));
    // Resolve exact coords via Google Place Details (API key stays server-side)
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(s.placeId)}`);
      const details = await res.json();
      if (details.lat && details.lng) {
        selectedCoordsRef.current = { lat: details.lat, lng: details.lng };
        if (details.postalCode) {
          setForm(prev => ({ ...prev, postalCode: prev.postalCode || details.postalCode }));
        }
        checkDeliveryZone({ lat: details.lat, lng: details.lng });
      }
    } catch { /* checkDeliveryZone on submit will surface appropriate error */ }
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

    // Coordinates must come from a Google Places selection — no free geocoding fallback
    if (!coordsArg || !isFinite(coordsArg.lat) || !isFinite(coordsArg.lng)) {
      setCheckingAddress(false);
      setAddressError('Selecciona tu dirección de la lista para que podamos verificar la zona de reparto.');
      return null;
    }
    const lat = coordsArg.lat;
    const lon = coordsArg.lng;

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
    // Small delay so a suggestion click fires before the dropdown hides
    setTimeout(() => setShowSuggestions(false), 150);
    if (orderType === 'delivery' && form.street.trim().length > 5 && !deliveryInfo && !addressError) {
      if (selectedCoordsRef.current) {
        checkDeliveryZone(selectedCoordsRef.current);
      } else {
        setAddressError('Selecciona tu dirección de la lista para verificar la zona de reparto.');
      }
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
    if (scheduleOrder && !form.scheduledDate.trim()) {
      toast({ title: 'Selecciona la fecha del pedido programado', variant: 'destructive' });
      return;
    }
    if (scheduleOrder && !form.scheduledTime.trim()) {
      toast({ title: 'Selecciona la hora del pedido programado', variant: 'destructive' });
      return;
    }
    if (scheduleOrder && scheduleError) {
      toast({ title: 'Horario no disponible', description: scheduleError, variant: 'destructive' });
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
      menu_item_id: (i._originalItem || i).id,
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      // flat list for display; per-flavor removals stored in flavors[]
      removed_ingredients: i._flavors
        ? i._flavors.flatMap(f => f.removed || [])
        : (i.removed_ingredients || []),
      flavors: i._flavors?.map(f => ({ id: f.id, name: f.name, removed: f.removed || [] })) || [],
      extras: i._extras?.map(e => ({ id: e.id, name: e.name, price: e.price })) || [],
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
      payment_method: paymentMethod,
      scheduled_for: scheduleOrder && form.scheduledDate && form.scheduledTime
        ? `${form.scheduledDate} ${form.scheduledTime}`
        : '',
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
        localStorage.setItem('mf_customer_phone', form.phone.trim());
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
              {scheduleOrder && form.scheduledDate && form.scheduledTime && (
                <p><span className="text-muted-foreground">Programado para:</span> <span className="font-medium">📅 {form.scheduledDate} · {form.scheduledTime}</span></p>
              )}
              <p><span className="text-muted-foreground">Pago:</span> <span className="font-medium">
                {paymentMethod === 'card'
                  ? (orderType === 'delivery' ? '💳 Datáfono a domicilio' : '💳 Datáfono en local')
                  : '💵 Efectivo (importe exacto)'}
              </span></p>
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
                    <p className="text-xs text-slate-500 mt-0.5">Quitar: {item.removed_ingredients.map(r => r.replace(/^Sin /, '')).join(', ')}</p>
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

          {paymentMethod === 'card' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <CreditCard className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-blue-800 font-semibold text-sm">
                  {orderType === 'delivery' ? 'Pago con datáfono a domicilio' : 'Pago con datáfono en el local'}
                </p>
                <p className="text-blue-600 text-xs mt-0.5">
                  {orderType === 'delivery'
                    ? 'El repartidor acudirá con un datáfono para realizar el cobro en el momento de la entrega.'
                    : 'Podrás pagar con tarjeta al recoger tu pedido en el local.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
              <Banknote className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-800 font-semibold text-sm">Pago en efectivo · importe exacto</p>
                <p className="text-amber-700 text-xs mt-0.5">Por favor, prepara el importe exacto de <strong>{finalTotal.toFixed(2)} €</strong>. No disponemos de cambio.</p>
              </div>
            </div>
          )}

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
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">No hay opciones disponibles</p>
              <p className="text-amber-700 text-xs mt-0.5">Tanto el delivery como la recogida están temporalmente cerrados. Disculpa las molestias.</p>
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

            {/* C3 — Programar pedido para más tarde */}
            <div className="bg-card rounded-2xl border border-border/50 p-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scheduleOrder}
                  onChange={e => setScheduleOrder(e.target.checked)}
                  className="w-4 h-4 accent-primary flex-shrink-0"
                />
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm">Programar para más tarde</span>
                </div>
              </label>
              {scheduleOrder && (
                <div className="mt-4 space-y-3 pl-7">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="scheduledDate" className="text-xs">Fecha *</Label>
                      <Input
                        id="scheduledDate"
                        type="date"
                        value={form.scheduledDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => updateField('scheduledDate', e.target.value)}
                        className="rounded-xl mt-1"
                        required={scheduleOrder}
                      />
                    </div>
                    <div>
                      <Label htmlFor="scheduledTime" className="text-xs">Hora *</Label>
                      <Input
                        id="scheduledTime"
                        type="time"
                        value={form.scheduledTime}
                        onChange={e => updateField('scheduledTime', e.target.value)}
                        className="rounded-xl mt-1"
                        required={scheduleOrder}
                      />
                    </div>
                  </div>
                  {scheduleError ? (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-700 font-medium">{scheduleError}</p>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">El horario es aproximado. Te llamaremos si hay algún cambio.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

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

          {/* C4 — Payment method selector */}
          <div className="bg-card rounded-2xl border border-border/50 p-5">
            <h2 className="font-heading font-semibold text-sm mb-3">Método de pago</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/40'}`}
              >
                <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-semibold ${paymentMethod === 'card' ? 'text-primary' : 'text-foreground'}`}>Datáfono</span>
                <span className="text-xs text-muted-foreground text-center leading-tight">Tarjeta al recibir el pedido</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === 'cash' ? 'border-amber-500 bg-amber-50' : 'border-border bg-background hover:border-amber-300'}`}
              >
                <Banknote className={`w-5 h-5 ${paymentMethod === 'cash' ? 'text-amber-600' : 'text-muted-foreground'}`} />
                <span className={`text-sm font-semibold ${paymentMethod === 'cash' ? 'text-amber-700' : 'text-foreground'}`}>Efectivo</span>
                <span className="text-xs text-muted-foreground text-center leading-tight">Solo importe exacto, sin cambio</span>
              </button>
            </div>
            {paymentMethod === 'card' && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                {orderType === 'delivery' ? 'El repartidor acude con datáfono. Se cobra al entregar.' : 'Paga con tarjeta al recoger tu pedido.'}
              </p>
            )}
            {paymentMethod === 'cash' && (
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  Por favor, prepara el importe exacto de <strong>{finalTotal.toFixed(2)} €</strong>. No disponemos de cambio.
                </p>
              </div>
            )}
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
