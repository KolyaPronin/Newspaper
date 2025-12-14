import React from 'react';
import { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
  headingValue: string;
  onHeadingChange: (value: string) => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  editor,
  headingValue,
  onHeadingChange,
}) => {
  if (!editor) return null;

  return (
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
      </div>
      <div className="tool-sep" />
      <div className="tool-group">
        <select
          className="tool-select"
          value={headingValue}
          onChange={(e) => onHeadingChange(e.target.value)}
          aria-label="Выбор стиля заголовка"
        >
          <option value="paragraph">Обычный текст</option>
          <option value="h1">Заголовок 1</option>
          <option value="h2">Заголовок 2</option>
          <option value="h3">Заголовок 3</option>
          <option value="h4">Заголовок 4</option>
          <option value="h5">Заголовок 5</option>
          <option value="h6">Заголовок 6</option>
        </select>
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
  );
};

export default EditorToolbar;

