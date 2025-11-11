import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useArticles } from '../../contexts/ArticleContext';

const AuthorEditor: React.FC = () => {
  const { currentArticle, saveDraft, submitForReview, setCurrentArticle } = useArticles();
  const [title, setTitle] = useState<string>(currentArticle?.title || '');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
        // Отключаем встроенный Link из StarterKit, используем свой с автолинками
        link: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Image.configure({
        HTMLAttributes: { class: 'editor-image' },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: 'editor-table' },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: currentArticle?.content || '',
    editorProps: {
      attributes: {
        'data-placeholder': 'Начните писать статью...',
      },
    },
  });

  // Загружаем статью при монтировании или изменении currentArticle
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

  const [headingValue, setHeadingValue] = useState<string>('paragraph');

  useEffect(() => {
    if (!editor) return undefined;

    const updateHeading = () => {
      let value = 'paragraph';
      for (let level = 1; level <= 6; level++) {
        if (editor.isActive('heading', { level })) {
          value = `h${level}`;
          break;
        }
      }
      setHeadingValue(value);
    };

    updateHeading();
    editor.on('selectionUpdate', updateHeading);
    editor.on('transaction', updateHeading);

    return () => {
      editor.off('selectionUpdate', updateHeading);
      editor.off('transaction', updateHeading);
    };
  }, [editor]);

  const applyHeading = (value: string) => {
    if (!editor) return;
    editor.chain().focus();
    if (value === 'paragraph') {
      editor.chain().focus().setParagraph().run();
      setHeadingValue('paragraph');
      return;
    }
    const level = Number(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6;
    editor.chain().focus().setHeading({ level }).run();
    setHeadingValue(value);
  };

  const promptForLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    // eslint-disable-next-line no-alert
    const url = window.prompt('Введите ссылку', previousUrl ?? '');
    if (url === null) {
      return;
    }
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const promptForImage = () => {
    if (!editor) return;
    // eslint-disable-next-line no-alert
    const url = window.prompt('URL изображения');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const insertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const handleSaveDraft = () => {
    if (!editor || !title.trim()) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return;
    }

    setSaveStatus('saving');
    try {
      const content = editor.getHTML();
      const existingId = currentArticle?.id ? currentArticle.id : undefined;
      const article = saveDraft(title.trim(), content, existingId);
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

      // Всегда сохраняем перед отправкой, чтобы зафиксировать текущую версию и статус "draft"
      const savedArticle = saveDraft(title.trim(), content, currentArticle?.id);
      articleId = savedArticle.id;

      submitForReview(articleId);
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
        <div className="editor-toolbar" role="toolbar" aria-label="Форматирование">
          <div className="tool-group">
            <button
              type="button"
              className={`tool-btn ${editor.isActive('bold') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-label="Жирный"
              title="Жирный"
              disabled={!editor.can().chain().focus().toggleBold().run()}
            >
              B
            </button>
            <button
              type="button"
              className={`tool-btn ${editor.isActive('italic') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              aria-label="Курсив"
              title="Курсив"
              disabled={!editor.can().chain().focus().toggleItalic().run()}
            >
              <i>I</i>
            </button>
            <button
              type="button"
              className={`tool-btn ${editor.isActive('underline') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              aria-label="Подчёркнутый"
              title="Подчёркнутый"
            >
              U
            </button>
            <button
              type="button"
              className={`tool-btn ${editor.isActive('strike') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              aria-label="Зачёркнутый"
              title="Зачёркнутый"
            >
              S
            </button>
            <button
              type="button"
              className={`tool-btn ${editor.isActive('highlight') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleHighlight().run()}
              aria-label="Выделение"
              title="Выделение"
            >
              ✺
            </button>
          </div>
          <div className="tool-sep" />
          <div className="tool-group">
            <select
              className="tool-select"
              value={headingValue}
              onChange={(e) => applyHeading(e.target.value)}
              aria-label="Выбор стиля заголовка"
            >
              <option value="paragraph">Параграф</option>
              <option value="h1">Заголовок 1</option>
              <option value="h2">Заголовок 2</option>
              <option value="h3">Заголовок 3</option>
              <option value="h4">Заголовок 4</option>
              <option value="h5">Заголовок 5</option>
              <option value="h6">Заголовок 6</option>
            </select>
            <button
              type="button"
              className={`tool-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              title="Цитата"
            >
              ❝ ❞
            </button>
          </div>
          <div className="tool-sep" />
          <div className="tool-group">
            <button
              type="button"
              className={`tool-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              title="Выровнять влево"
            >
              ⇤
            </button>
            <button
              type="button"
              className={`tool-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              title="По центру"
            >
              ⇆
            </button>
            <button
              type="button"
              className={`tool-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              title="Выровнять вправо"
            >
              ⇥
            </button>
            <button
              type="button"
              className={`tool-btn ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              title="По ширине"
            >
              ☰
            </button>
          </div>
          <div className="tool-sep" />
          <div className="tool-group">
            <button
              type="button"
              className={`tool-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Маркированный список"
            >
              • • •
            </button>
            <button
              type="button"
              className={`tool-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Нумерованный список"
            >
              1 2 3
            </button>
          </div>
          <div className="tool-sep" />
          <div className="tool-group">
            <button type="button" className="tool-btn" onClick={promptForLink} title="Вставить ссылку">
              🔗
            </button>
            <button type="button" className="tool-btn" onClick={() => editor.chain().focus().unsetLink().run()} title="Удалить ссылку">
              ⛓✕
            </button>
            <button type="button" className="tool-btn" onClick={promptForImage} title="Вставить изображение">
              🖼
            </button>
            <button type="button" className="tool-btn" onClick={insertTable} title="Вставить таблицу">
              ⌗
            </button>
          </div>
          <div className="tool-sep" />
          <div className="tool-group">
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor.chain().focus().undo().run()}
              title="Отменить"
            >
              ↶
            </button>
            <button
              type="button"
              className="tool-btn"
              onClick={() => editor.chain().focus().redo().run()}
              title="Повторить"
            >
              ↷
            </button>
          </div>
        </div>
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
