import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';

const ADMIN_PASSWORD = 'mozzarellayfuego123';

export default function AdminLogin({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', '1');
      onSuccess();
    } else {
      setError(true);
      setPassword('');
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
          <Input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            className={error ? 'border-destructive' : ''}
            autoFocus
          />
          {error && <p className="text-destructive text-sm text-center">Contraseña incorrecta</p>}
          <Button type="submit" className="w-full">Entrar</Button>
        </form>
      </div>
    </div>
  );
}