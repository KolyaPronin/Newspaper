import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContexts';
import { mockUsers } from '../../data/users';
import { User, UserRole } from '../../types/User';

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [role, setRole] = useState<UserRole | ''>('');

  const roleOptions = useMemo<UserRole[]>(() => {
    // берем роли из enum, чтобы были все доступные, а не только из моков
    return [
      UserRole.AUTHOR,
      UserRole.PROOFREADER,
      UserRole.ILLUSTRATOR,
      UserRole.LAYOUT_DESIGNER,
      UserRole.CHIEF_EDITOR
    ];
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Временно: эмулируем вход без сервера.
    // Если поля пусты, можно подставить из моков для удобства.
    let selectedRole = role || mockUsers[0].role;
    let finalUsername = username.trim() || `user_${selectedRole}`;
    
    // Ищем пользователя в моках по роли, или создаем стабильный ID на основе username + role
    const mockUser = mockUsers.find(u => u.role === selectedRole);
    let userId: string;
    
    if (mockUser) {
      // Используем ID из моков для стабильности
      userId = mockUser.id;
      finalUsername = mockUser.username;
    } else {
      // Создаем стабильный ID на основе username + role (hash)
      const hash = `${finalUsername}_${selectedRole}`.split('').reduce((acc, char) => {
        acc = ((acc << 5) - acc) + char.charCodeAt(0);
        return acc & acc;
      }, 0);
      userId = `user_${Math.abs(hash)}`;
    }
    
    const user: User = {
      id: userId,
      username: finalUsername,
      email: `${finalUsername}@local`,
      role: selectedRole
    };
    login(user);
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Вход</h1>
        <p className="auth-subtitle">Введите данные и выберите роль</p>
        <form className="auth-form" onSubmit={handleSubmit}>
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
          <button type="submit" className="btn">Войти</button>
        </form>
      </div>
    </div>
  );
};

export default LoginForm;