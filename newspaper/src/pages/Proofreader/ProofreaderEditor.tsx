import React, { useEffect, useState } from 'react';
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

  // Корректор всегда должен иметь возможность редактировать выбранную статью
  const editor = useTipTapEditor(currentArticle?.content || '', true);

  useEffect(() => {
    if (!editor) return;

    if (currentArticle) {
      editor.commands.setContent(currentArticle.content);
    } else {
      editor.commands.clearContent();
    }
  }, [currentArticle, editor]);

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

  const handleReturn = async () => {
    if (!currentArticle) return;
    setReturnStatus('processing');
    try {
      await requestRevision(currentArticle.id);
      setCurrentArticle(null);
      setReturnStatus('done');
      setTimeout(() => setReturnStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to return article to author:', error);
      setReturnStatus('error');
      setTimeout(() => setReturnStatus('idle'), 2000);
    }
  };

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
            onClick={handleReturn}
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

      <div style={{ background: 'rgba(21,24,33,0.25)', border: '1px solid rgba(38,42,54,0.3)', borderRadius: 12, padding: 12 }}>
        {editor ? <EditorContent editor={editor} /> : <p className="article-empty">Выберите статью для редактирования.</p>}
      </div>
    </div>
  );
};

export default ProofreaderEditor;
