import { useQuery } from '@tanstack/react-query';

export async function fetchStoreSettings() {
  const res = await fetch('/api/adminSettings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get' }),
  });
  const d = await res.json();
  return {
    store_open: d?.store_open !== false,
    delivery_enabled: d?.delivery_enabled !== false,
    pickup_enabled: d?.pickup_enabled !== false,
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
