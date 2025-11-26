import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContexts';

const LoginForm: React.FC = () => {
  const { login, loading } = useAuth();
  const [identifier, setIdentifier] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      setError('请输入邮箱或用户名以及密码');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      if (identifier.includes('@')) {
        await login({ email: identifier.trim(), password: password.trim() });
      } else {
        await login({ username: identifier.trim(), password: password.trim() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Вход</h1>
        <p className="auth-subtitle">使用注册好的邮箱/用户名登录系统</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="identifier">邮箱或用户名</label>
            <input
              id="identifier"
              className="input"
              type="text"
              placeholder="例如：ivan@newspaper.zeta"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username email"
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
              autoComplete="current-password"
            />
          </div>
          {error && <p style={{ color: '#f87171', fontSize: 14, marginBottom: 12 }}>{error}</p>}
          <button type="submit" className="btn" disabled={isSubmitting || loading}>
            {isSubmitting ? '登录中...' : '登录'}
          </button>
          <p style={{ fontSize: 12, color: 'var(--subtext)', marginTop: 12 }}>
            默认测试账号：`ivan@newspaper.zeta / password123`
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;