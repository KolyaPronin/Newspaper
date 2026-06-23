import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { EditorContent } from '@tiptap/react';
import { useArticles } from '../../contexts/ArticleContext';
import { useTipTapEditor } from '../../hooks/useTipTapEditor';
import { useEditorToolbar } from '../../hooks/useEditorToolbar';
import EditorToolbar from '../../components/Editor/EditorToolbar';

const ProofreaderEditor: React.FC = () => {
  const { currentArticle, updateArticleContent, approveArticle, requestRevision, setCurrentArticle } = useArticles();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [approveStatus, setApproveStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [returnStatus, setReturnStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  const [returnError, setReturnError] = useState<string | null>(null);

  const editor = useTipTapEditor(currentArticle?.content || '', true);

  useEffect(() => {
    if (!editor) return;

    if (currentArticle) {
      editor.commands.setContent(currentArticle.content);
    } else {
      editor.commands.clearContent();
    }
  }, [currentArticle, editor]);

  useEffect(() => {
    if (!returnModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [returnModalOpen]);

  const { headingValue, applyHeading } = useEditorToolbar(editor);

  const handleSave = async () => {
    if (!editor || !currentArticle) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return;
    }

    setSaveStatus('saving');
    try {
      const content = editor.getHTML();
      await updateArticleContent(currentArticle.id, content);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save proofreader changes:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleApprove = async () => {
    if (!currentArticle) return;
    setApproveStatus('processing');
    try {
      await approveArticle(currentArticle.id);
      setApproveStatus('done');
      setTimeout(() => setApproveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to approve article:', error);
      setApproveStatus('error');
      setTimeout(() => setApproveStatus('idle'), 2000);
    }
  };

  const openReturnModal = () => {
    setRevisionNote('');
    setReturnError(null);
    setReturnModalOpen(true);
  };

  const closeReturnModal = () => {
    if (returnStatus === 'processing') return;
    setReturnModalOpen(false);
    setReturnError(null);
  };

  const handleReturn = async () => {
    if (!currentArticle) return;
    if (!revisionNote.trim()) {
      setReturnError('Опишите, что нужно исправить');
      return;
    }

    setReturnStatus('processing');
    setReturnError(null);
    try {
      await requestRevision(currentArticle.id, revisionNote.trim());
      setReturnModalOpen(false);
      setRevisionNote('');
      setCurrentArticle(null);
      setReturnStatus('done');
      setTimeout(() => setReturnStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to return article to author:', error);
      setReturnError(error instanceof Error ? error.message : 'Не удалось вернуть статью');
      setReturnStatus('error');
      setTimeout(() => setReturnStatus('idle'), 2000);
    }
  };

  const returnModal = returnModalOpen ? createPortal(
    <div className="task-modal-backdrop" onClick={closeReturnModal}>
      <div
        className="task-modal task-modal-detail"
        role="dialog"
        aria-modal
        aria-labelledby="revision-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="task-modal-header">
          <h3 id="revision-modal-title">Вернуть автору</h3>
          <button
            type="button"
            className="task-modal-close"
            onClick={closeReturnModal}
            disabled={returnStatus === 'processing'}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="task-detail-body">
          <p className="task-detail-article">
            Статья: <strong>{currentArticle?.title || 'Без названия'}</strong>
          </p>
          <label className="template-select-label">
            Заметка для автора *
            <textarea
              className="template-select task-textarea task-textarea-desc"
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              disabled={returnStatus === 'processing'}
              rows={5}
              placeholder="Что не так и что нужно поправить..."
              autoFocus
            />
          </label>
          {returnError && <div className="error-message">{returnError}</div>}
        </div>

        <div className="task-modal-footer">
          <button
            type="button"
            className="btn btn-auto"
            onClick={closeReturnModal}
            disabled={returnStatus === 'processing'}
          >
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-auto task-danger"
            onClick={() => void handleReturn()}
            disabled={returnStatus === 'processing'}
          >
            {returnStatus === 'processing' ? 'Отправка...' : 'Вернуть автору'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className="proofreader-editor">
      <div className="workspace-header" style={{ marginBottom: 12 }}>
        <div>
          <h2>Проверка статьи</h2>
          <p>{currentArticle ? currentArticle.title : 'Выберите статью из списка слева.'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn"
            onClick={handleSave}
            disabled={!currentArticle || saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Сохранение...' : saveStatus === 'saved' ? '✓ Сохранено' : saveStatus === 'error' ? '✗ Ошибка' : 'Сохранить правки'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={openReturnModal}
            disabled={!currentArticle || returnStatus === 'processing'}
            style={{ background: returnStatus === 'done' ? '#f97316' : undefined }}
          >
            {returnStatus === 'processing' ? 'Возврат...' : returnStatus === 'done' ? '✓ Отправлено автору' : returnStatus === 'error' ? '✗ Ошибка' : 'Вернуть автору'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleApprove}
            disabled={!currentArticle || approveStatus === 'processing'}
            style={{ background: approveStatus === 'done' ? '#10b981' : undefined }}
          >
            {approveStatus === 'processing' ? 'Одобрение...' : approveStatus === 'done' ? '✓ Одобрено' : approveStatus === 'error' ? '✗ Ошибка' : 'Одобрить'}
          </button>
        </div>
      </div>

      {editor && (
        <EditorToolbar
          editor={editor}
          headingValue={headingValue}
          onHeadingChange={applyHeading}
        />
      )}

      <div className="proofreader-editor-panel">
        {editor ? <EditorContent editor={editor} /> : <p className="article-empty">Выберите статью для редактирования.</p>}
      </div>

      {returnModal}
    </div>
  );
};

export default ProofreaderEditor;
