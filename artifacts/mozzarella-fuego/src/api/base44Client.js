// Base44 SDK removed — replaced by direct fetch calls to /api/*
// This stub keeps imports from breaking during migration.

const noop = () => Promise.resolve({});
const noopVoid = () => {};

export const base44 = {
  auth: {
    me: () => Promise.reject(new Error('base44.auth not available')),
    logout: noopVoid,
    redirectToLogin: noopVoid,
  },
  entities: {},
  functions: {
    invoke: () => Promise.resolve({ data: null }),
  },
};

export default base44;
