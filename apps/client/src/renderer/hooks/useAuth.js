import { useState, useEffect, useCallback } from 'react';
import { authStorage } from '../services/authStorage';

export function useAuthContext() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = authStorage.getUser();
    const token = authStorage.getToken();

    if (storedUser && token) {
      setUser(storedUser);
    }

    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    authStorage.clearUser();
    authStorage.clearToken();
    setUser(null);
  }, []);

  return { user, setUser, loading, logout };
}
