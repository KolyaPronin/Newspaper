import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, UserRole, AuthContextType, LoginPayload, RegisterPayload } from '../types/User';
import { authAPI, setAuthToken } from '../utils/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_STORAGE_KEY = 'newspaper_auth_token';

const getStorage = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  return window.localStorage;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [pending, setPending] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const persistToken = useCallback((nextToken: string | null) => {
    setToken(nextToken);
    setAuthToken(nextToken);
    const storage = getStorage();
    if (!storage) {
      return;
    }
    if (nextToken) {
      storage.setItem(TOKEN_STORAGE_KEY, nextToken);
    } else {
      storage.removeItem(TOKEN_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      const storage = getStorage();
      if (!storage) {
        setInitializing(false);
        return;
      }

      const storedToken = storage.getItem(TOKEN_STORAGE_KEY);
      if (!storedToken) {
        setInitializing(false);
        return;
      }

      persistToken(storedToken);
      try {
        const currentUser = await authAPI.me();
        setUser(currentUser);
      } catch (err) {
        console.error('Failed to restore session', err);
        persistToken(null);
      } finally {
        setInitializing(false);
      }
    };

    restoreSession();
  }, [persistToken]);

  const login = useCallback(async (credentials: LoginPayload) => {
    setPending(true);
    setError(null);
    try {
      const response = await authAPI.login(credentials);
      setUser(response.user);
      persistToken(response.token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to login';
      setError(message);
      throw err;
    } finally {
      setPending(false);
    }
  }, [persistToken]);

  const register = useCallback(async (payload: RegisterPayload) => {
    setPending(true);
    setError(null);
    try {
      const response = await authAPI.register(payload);
      setUser(response.user);
      persistToken(response.token);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register';
      setError(message);
      throw err;
    } finally {
      setPending(false);
    }
  }, [persistToken]);

  const logout = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Failed to logout', err);
    } finally {
    setUser(null);
      persistToken(null);
      setPending(false);
    }
  }, [persistToken]);

  const hasRole = useCallback((role: UserRole | UserRole[]): boolean => {
    if (!user) {
      return false;
    }
    const allowedRoles = Array.isArray(role) ? role : [role];
    return allowedRoles.includes(user.role);
  }, [user]);

  const contextValue: AuthContextType = {
    user,
    token,
    loading: initializing || pending,
    error,
    login,
    register,
    logout,
    hasRole,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export {};