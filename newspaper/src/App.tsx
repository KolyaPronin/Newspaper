import React from 'react';
import './styles/base.css';
import Dashboard from './pages/Dashboard/Dashboard';
import { AuthProvider } from './contexts/AuthContexts';
import { ArticleProvider } from './contexts/ArticleContext';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ArticleProvider>
        <Dashboard />
      </ArticleProvider>
    </AuthProvider>
  );
};

export default App;