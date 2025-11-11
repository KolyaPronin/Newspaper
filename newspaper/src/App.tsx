import React from 'react';
import './styles/App.css';
import Dashboard from './pages/Dashboard/Dashboard';
import { AuthProvider } from './contexts/AuthContexts';

const App: React.FC = () => {
  return (
    <div className="app-background" style={{ backgroundImage: `url('/Mokka-tree.jpg')` }}>
      <AuthProvider>
        <Dashboard />
      </AuthProvider>
    </div>
  );
};

export default App;