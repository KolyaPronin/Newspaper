import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, UserRole, AuthContextType, LoginPayload } from '../types/User';
import { authApi } from '../utils/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedAuth = localStorage.getItem('newspaper_auth');
    if (storedAuth) {
      try {
        const parsed = JSON.parse(storedAuth);
        setUser(parsed.user ?? null);
        setToken(parsed.token ?? null);
      } catch (error) {
        console.error('Failed to parse stored auth data', error);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && token) {
      localStorage.setItem('newspaper_auth', JSON.stringify({ user, token }));
    } else {
      localStorage.removeItem('newspaper_auth');
    }
  }, [user, token]);

  const login = async (credentials: LoginPayload) => {
    const result = await authApi.login(credentials);
    setUser(result.user);
    setToken(result.token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const hasRole = (role: UserRole): boolean => {
    return user?.role === role;
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole }}>
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