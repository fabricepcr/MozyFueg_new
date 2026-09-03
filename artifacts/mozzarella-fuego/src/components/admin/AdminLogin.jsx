import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';

export default function AdminLogin({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(true);
        setPassword('');
        return;
      }
      sessionStorage.setItem('admin_auth', '1');
      onSuccess();
    } catch {
      setError(true);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-body flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold">Panel de Admin</h1>
          <p className="text-muted-foreground text-sm mt-1">Mozzarella y Fuego</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="username"
            value="admin"
            readOnly
            autoComplete="username"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <Input
            name="password"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            className={error ? 'border-destructive' : ''}
            autoFocus
            autoComplete="current-password"
          />
          {error && <p className="text-destructive text-sm text-center">Contraseña incorrecta</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Verificando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
