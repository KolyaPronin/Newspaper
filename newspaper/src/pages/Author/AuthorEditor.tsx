import React, { useEffect, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { useArticles } from '../../contexts/ArticleContext';
import { useTipTapEditor } from '../../hooks/useTipTapEditor';
import { useEditorToolbar } from '../../hooks/useEditorToolbar';
import EditorToolbar from '../../components/Editor/EditorToolbar';

const AuthorEditor: React.FC = () => {
  const { currentArticle, saveDraft, submitForReview, setCurrentArticle } = useArticles();
  const [title, setTitle] = useState<string>(currentArticle?.title || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  const editor = useTipTapEditor(currentArticle?.content || '', true);

  useEffect(() => {
    if (!editor) return;

    if (currentArticle) {
      setTitle(currentArticle.title);
      editor.commands.setContent(currentArticle.content);
    } else {
      setTitle('');
      editor.commands.clearContent();
    }
  }, [currentArticle, editor]);

  const { headingValue, applyHeading } = useEditorToolbar(editor);

  const handleSaveDraft = async () => {
    if (!editor || !title.trim()) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return;
    }

    setSaveStatus('saving');
    try {
      const content = editor.getHTML();
      const existingId = currentArticle?.id ? currentArticle.id : undefined;
      const article = await saveDraft(title.trim(), content, existingId);
      setCurrentArticle(article);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save draft:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleSubmitForReview = async () => {
    if (!editor || !title.trim()) {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 2000);
      return;
    }

    setSubmitStatus('submitting');
    try {
      const content = editor.getHTML();
      let articleId = currentArticle?.id;

      const savedArticle = await saveDraft(title.trim(), content, currentArticle?.id);
      articleId = savedArticle.id;

      await submitForReview(articleId);
      setSubmitStatus('submitted');
      setTimeout(() => setSubmitStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to submit for review:', error);
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 2000);
    }
  };

  return (
    <div className="author-editor-wrapper">
      <div style={{ marginBottom: 16 }}>
        {!currentArticle && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--subtext)' }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>Выберите статью из списка или создайте новую</p>
            <p style={{ fontSize: 14 }}>Нажмите «+ Новая статья» чтобы начать</p>
          </div>
        )}
        {currentArticle && (
          <>
            <h2 style={{ margin: '0 0 12px 0' }}>Редактор статьи</h2>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="label" htmlFor="article-title">Заголовок статьи</label>
              <input
                id="article-title"
                className="input"
                type="text"
                placeholder="Введите заголовок..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ fontSize: 16, fontWeight: 500 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                className="btn"
                onClick={handleSaveDraft}
                disabled={saveStatus === 'saving' || !title.trim()}
                style={{ flex: 1 }}
              >
                {saveStatus === 'saving' ? 'Сохранение...' : saveStatus === 'saved' ? '✓ Сохранено' : saveStatus === 'error' ? '✗ Ошибка' : 'Сохранить черновик'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleSubmitForReview}
                disabled={submitStatus === 'submitting' || !title.trim()}
                style={{ flex: 1, background: submitStatus === 'submitted' ? '#10b981' : undefined }}
              >
                {submitStatus === 'submitting' ? 'Отправка...' : submitStatus === 'submitted' ? '✓ Отправлено на проверку' : submitStatus === 'error' ? '✗ Ошибка' : 'Отправить на проверку'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--subtext)', marginBottom: 8 }}>
              Статус: {currentArticle.status === 'draft' ? 'Черновик' : currentArticle.status === 'under_review' ? 'На проверке' : currentArticle.status}
              {currentArticle.updatedAt && ` • Обновлено: ${new Date(currentArticle.updatedAt).toLocaleString('ru-RU')}`}
            </div>
          </>
        )}
      </div>
      {currentArticle && editor && (
        <EditorToolbar
          editor={editor}
          headingValue={headingValue}
          onHeadingChange={applyHeading}
        />
      )}
      {currentArticle && (
        <div style={{ background: 'rgba(21,24,33,0.25)', border: '1px solid rgba(38,42,54,0.3)', borderRadius: 12, padding: 12 }} className="editor-content-wrapper">
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
};

export default AuthorEditor;
