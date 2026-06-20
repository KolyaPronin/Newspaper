import React, { useState } from 'react';
import TaskBoard from '../../components/ChiefEditor/TaskBoard';
import LayoutReviewPanel from '../../components/ChiefEditor/LayoutReviewPanel';

const ChiefEditorWorkspace: React.FC = () => {
  const [activeView, setActiveView] = useState<'tasks' | 'review'>('tasks');

  return (
    <div className="chief-editor-workspace">
      <div className="workspace-header">
        <div>
          <h1>{activeView === 'tasks' ? 'Доска задач' : 'Проверка макетов'}</h1>
          <p>{activeView === 'tasks' ? 'Управляйте задачами выпусков' : 'Просматривайте и одобряйте макеты верстальщика'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`btn btn-auto ${activeView === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveView('tasks')}
          >
            Задачи
          </button>
          <button
            type="button"
            className={`btn btn-auto ${activeView === 'review' ? 'active' : ''}`}
            onClick={() => setActiveView('review')}
          >
            Проверка макетов
          </button>
        </div>
      </div>
      {activeView === 'tasks' ? <TaskBoard /> : <LayoutReviewPanel />}
    </div>
  );
};

export default ChiefEditorWorkspace;
