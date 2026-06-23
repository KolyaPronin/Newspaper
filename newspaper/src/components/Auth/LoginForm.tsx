import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContexts';
import { UserRole } from '../../types/User';

type AuthMode = 'login' | 'register';

const LoginForm: React.FC = () => {
  const { login, register, loading, error: authError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole | ''>('');
  const [localError, setLocalError] = useState<string | null>(null);

  const roleOptions = useMemo<UserRole[]>(() => [
      UserRole.AUTHOR,
      UserRole.PROOFREADER,
      UserRole.ILLUSTRATOR,
      UserRole.LAYOUT_DESIGNER,
    UserRole.CHIEF_EDITOR,
  ], []);

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setRole('');
    setLocalError(null);
  };

  const switchMode = () => {
    setMode(prev => (prev === 'login' ? 'register' : 'login'));
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          setLocalError('Введите email и пароль');
          return;
        }
        await login({ email: email.trim().toLowerCase(), password });
      } else {
        if (!username.trim() || !email.trim() || !password || !role) {
          setLocalError('Заполните все поля и выберите роль');
          return;
        }
        await register({
          username: username.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
        });
      }
    } catch {
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Введите email и пароль, чтобы войти'
            : 'Создайте новый аккаунт, выбрав роль'}
        </p>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
          <div className="field">
            <label className="label" htmlFor="username">Логин</label>
            <input
              id="username"
              className="input"
              type="text"
              placeholder="например, ivan"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              />
            </div>
          )}
          <div className="field">
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              className="input"
              type="email"
              placeholder="ivan@newspaper.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={mode === 'login' ? 'email' : 'new-email'}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">Пароль</label>
            <input
              id="password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {mode === 'register' && (
          <div className="field">
            <label className="label" htmlFor="role">Роль</label>
            <select
              id="role"
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="" disabled>Выберите роль</option>
              {roleOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          )}
          {(localError || authError) && (
            <div style={{ 
              padding: '8px 12px', 
              background: '#fee2e2', 
              border: '1px solid #fca5a5', 
              borderRadius: 6, 
              marginBottom: 12,
              color: '#991b1b',
              fontSize: 14
            }}>
              {localError || authError}
            </div>
          )}
          <button 
            type="submit" 
            className="btn" 
            disabled={loading}
          >
            {loading ? 'Подождите...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
          </button>
          <button
            type="button"
            className="btn"
            style={{ marginTop: 12, backgroundColor: '#111827' }}
            onClick={switchMode}
          >
            {mode === 'login' ? 'Создать аккаунт' : 'У меня уже есть аккаунт'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;