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

const ProofreaderEditor: React.FC = () => {
  const { currentArticle, updateArticleContent, approveArticle, requestRevision, setCurrentArticle } = useArticles();
  const [headingValue, setHeadingValue] = useState<string>('paragraph');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [approveStatus, setApproveStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [returnStatus, setReturnStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
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
    editable: Boolean(currentArticle),
  });

  useEffect(() => {
    if (!editor) return;

    if (currentArticle) {
      editor.commands.setContent(currentArticle.content);
    } else {
      editor.commands.clearContent();
    }
  }, [currentArticle, editor]);

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
    const url = window.prompt('URL изображения');
    if (!url) return;
    editor.chain().focus().setImage({ src: url }).run();
  };

  const insertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

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

      <div style={{ background: 'rgba(21,24,33,0.25)', border: '1px solid rgba(38,42,54,0.3)', borderRadius: 12, padding: 12 }}>
        {editor ? <EditorContent editor={editor} /> : <p className="article-empty">Выберите статью для редактирования.</p>}
      </div>
    </div>
  );
};

export default ProofreaderEditor;
