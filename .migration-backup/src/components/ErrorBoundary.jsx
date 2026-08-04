// src/components/ErrorBoundary.jsx
// Evita la "pantalla en blanco": si algo falla al renderizar, muestra
// una pantalla de recuperación en lugar de dejar la web vacía.
import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <div>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🍕</p>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Ha ocurrido un problema al mostrar el panel</h2>
            <p style={{ color: '#666', marginBottom: 16 }}>Tus pedidos siguen guardados. Recarga para volver a verlos.</p>
            <button
              onClick={() => window.location.reload()}
              style={{ background: '#e63946', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}
            >
              Recargar panel
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
