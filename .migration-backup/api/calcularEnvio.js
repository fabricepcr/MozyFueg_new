// api/calcularEnvio.js
// Calcula la distancia REAL por carretera (Google Distance Matrix) entre la
// pizzería y la dirección del cliente, y decide si entra en la zona de reparto.
// La API key vive solo en Vercel (variable de entorno), nunca en el navegador.

const RESTAURANT_LAT = 41.4116;
const RESTAURANT_LNG = 2.1751;
const MAX_DELIVERY_KM = 8;

function calcDeliveryFee(km) {
  if (km <= 4) return 4;
  if (km <= 5) return 5;
  if (km <= 6) return 6;
  if (km <= 7) return 7;
  return 8;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { destLat, destLng } = req.body;

    if (!isFinite(destLat) || !isFinite(destLng)) {
      return res.status(400).json({ error: 'Coordenadas de destino no válidas' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error('Falta GOOGLE_MAPS_API_KEY en las variables de entorno de Vercel');
      return res.status(500).json({ error: 'Configuración de mapas no disponible' });
    }

    const origin = `${RESTAURANT_LAT},${RESTAURANT_LNG}`;
    const destination = `${destLat},${destLng}`;
    // mode=driving: ruta por calles reales (lo que sigue una moto en ciudad).
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json`
      + `?origins=${origin}`
      + `&destinations=${destination}`
      + `&mode=driving`
      + `&departure_time=now`
      + `&language=es`
      + `&region=es`
      + `&key=${apiKey}`;

    const gRes = await fetch(url);
    const gData = await gRes.json();

    if (gData.status !== 'OK') {
      console.error('Google Distance Matrix status:', gData.status, gData.error_message || '');
      return res.status(502).json({ error: 'No se pudo calcular la distancia' });
    }

    const element = gData.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      return res.json({ ok: false, reason: 'no_route' });
    }

    const km = parseFloat((element.distance.value / 1000).toFixed(2));
    const durationSec = (element.duration_in_traffic || element.duration).value;
    const estimatedMin = Math.round(durationSec / 60) + 15;

    if (km > MAX_DELIVERY_KM) {
      return res.json({ ok: false, reason: 'too_far', km });
    }

    const fee = calcDeliveryFee(km);
    return res.json({ ok: true, km, fee, estimatedMin });
  } catch (error) {
    console.error('calcularEnvio error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
