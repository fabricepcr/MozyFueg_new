import { useQuery } from '@tanstack/react-query';

export async function fetchStoreSettings() {
  const res = await fetch('/api/adminSettings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getPublicSettings' }),
  });
  const d = await res.json();
  // Express returns: { data: { storeOpen, deliveryActive, pickupActive } }
  return {
    store_open: d?.data?.storeOpen !== false,
    delivery_enabled: d?.data?.deliveryActive !== false,
    pickup_enabled: d?.data?.pickupActive !== false,
  };
}

export function useStoreSettings() {
  return useQuery({
    queryKey: ['storeSettings'],
    queryFn: fetchStoreSettings,
    refetchInterval: 20000,
    staleTime: 10000,
  });
}
