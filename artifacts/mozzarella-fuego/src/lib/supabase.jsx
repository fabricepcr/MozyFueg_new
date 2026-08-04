/**
 * supabase.jsx — safe no-op stub
 * Supabase has been removed. This stub keeps legacy imports from crashing.
 * The app now talks exclusively to the Replit Postgres backend via /api/*.
 */

const noopAsync = async () => ({ data: null, error: null });

function makeChain() {
  const chain = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: () => chain,
    neq: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    single: noopAsync,
    maybeSingle: noopAsync,
    then(fn) { return Promise.resolve({ data: null, error: null }).then(fn); },
    catch(fn) { return Promise.resolve({ data: null, error: null }).catch(fn); },
  };
  return chain;
}

const noopChannel = {
  on() { return this; },
  subscribe() { return this; },
};

export const supabase = {
  from: () => makeChain(),
  channel: () => noopChannel,
  removeChannel: () => {},
  auth: {
    getUser: noopAsync,
    signInWithOtp: noopAsync,
    signOut: noopAsync,
    onAuthStateChange: () => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },
};
