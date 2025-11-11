import React from 'react';
import { useAuth } from '../../contexts/AuthContexts';
import LoginForm from '../../components/Auth/LoginForm';
import { getRoutesForRole } from '../../utils/roles';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  if (!user) {
    return (
      <div className="dashboard">
        <header className="app-header">
          <h1>NEWSPAPER</h1>
          <p>Добро пожаловать. Авторизуйтесь, чтобы продолжить.</p>
        </header>
        <LoginForm />
      </div>
    );
  }

  const availableRoutes = getRoutesForRole(user.role);

  return (
    <div className="dashboard">
      <header className="app-header">
        <h1>NEWSPAPER</h1>
        <p>Здравствуйте, {user.username}. Роль: {user.role}</p>
      </header>
      
      <main>
        <div className="user-dashboard">
          <h2>Твоя панель управления</h2>
          <p>Доступные разделы:</p>
          <ul>
            {availableRoutes.map(route => (
              <li key={route}>{route}</li>
            ))}
          </ul>
          <button className="btn" onClick={logout}>Выйти</button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;