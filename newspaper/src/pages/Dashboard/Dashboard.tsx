import React from 'react';
import { useAuth } from '../../contexts/AuthContexts';
import LoginForm from '../../components/Auth/LoginForm';
import { getRoutesForRole } from '../../utils/roles';
import { UserRole } from '../../types/User';
import AuthorWorkspace from '../Author/AuthorWorkspace';
import ProofreaderWorkspace from '../Proofreader/ProofreaderWorkspace';
import LayoutDesignerWorkspace from '../LayoutDesigner/LayoutDesignerWorkspace';
import IllustratorWorkspace from '../Illustrator/IllustratorWorkspace';

const Dashboard: React.FC = () => {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-background" style={{ backgroundImage: `url('/Mokka-tree.jpg')` }}>
        <div className="dashboard">
          <header className="app-header">
            <h1>NEWSPAPER</h1>
            <p>Загрузка данных...</p>
          </header>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-background" style={{ backgroundImage: `url('/Mokka-tree.jpg')` }}>
        <div className="dashboard">
          <header className="app-header">
            <h1>NEWSPAPER</h1>
            <p>Добро пожаловать. Авторизуйтесь, чтобы продолжить.</p>
          </header>
          <LoginForm />
        </div>
      </div>
    );
  }

  if (user.role === UserRole.AUTHOR || String(user.role).toLowerCase() === 'author') {
    return (
      <div className="dashboard">
        <header className="app-header">
          <h1>NEWSPAPER</h1>
          <p>Здравствуйте, {user.username}. Роль: Автор</p>
        </header>
        <main>
          <AuthorWorkspace />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <button className="btn" onClick={() => logout()} style={{ maxWidth: 240 }}>
              Выйти
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (user.role === UserRole.PROOFREADER || String(user.role).toLowerCase() === 'proofreader') {
    return (
      <div className="dashboard">
        <header className="app-header">
          <h1>NEWSPAPER</h1>
          <p>Здравствуйте, {user.username}. Роль: Корректор</p>
        </header>
        <main>
          <ProofreaderWorkspace />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <button className="btn" onClick={() => logout()} style={{ maxWidth: 240 }}>
              Выйти
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (user.role === UserRole.LAYOUT_DESIGNER || String(user.role).toLowerCase() === 'layout_designer') {
    return (
      <div className="dashboard">
        <header className="app-header">
          <h1>NEWSPAPER</h1>
          <p>Здравствуйте, {user.username}. Роль: Верстальщик</p>
        </header>
        <main>
          <LayoutDesignerWorkspace />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <button className="btn" onClick={() => logout()} style={{ maxWidth: 240 }}>
              Выйти
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (user.role === UserRole.ILLUSTRATOR || String(user.role).toLowerCase() === 'illustrator') {
    return (
      <div className="dashboard">
        <header className="app-header">
          <h1>NEWSPAPER</h1>
          <p>Здравствуйте, {user.username}. Роль: Иллюстратор</p>
        </header>
        <main>
          <IllustratorWorkspace />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
            <button className="btn" onClick={() => logout()} style={{ maxWidth: 240 }}>
              Выйти
            </button>
          </div>
        </main>
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
          <button className="btn" onClick={() => logout()}>Выйти</button>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;