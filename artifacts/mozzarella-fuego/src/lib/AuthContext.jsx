import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

/**
 * AuthProvider — minimal stub after Base44 auth removal.
 * The app uses a hardcoded admin password for admin routes, not OAuth.
 * This context keeps the API surface identical so all consumers work unchanged.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth] = useState(false);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError] = useState(null);
  const [authChecked] = useState(true);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    // Fetch public settings (store open/closed state) from our own API
    fetch('/api/adminSettings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getPublicSettings' }),
    })
      .then(r => r.json())
      .then(json => {
        if (json?.data) setAppPublicSettings(json.data);
      })
      .catch(() => {/* ignore — defaults to open */})
      .finally(() => setIsLoadingPublicSettings(false));
  }, []);

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {/* no-op — admin uses password */};

  const checkUserAuth = () => Promise.resolve();
  const checkAppState = () => Promise.resolve();

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
