import { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';

export const useEditorToolbar = (editor: Editor | null) => {
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

  return {
    headingValue,
    applyHeading,
    promptForLink,
    promptForImage,
    insertTable,
  };
};

