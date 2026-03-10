import { useState, useEffect, useCallback } from 'react';

export function useAuthContext() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = sessionStorage.getItem('user');
    const token = sessionStorage.getItem('token');

    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }

    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    setUser(null);
  }, []);

  return { user, setUser, loading, logout };
}
