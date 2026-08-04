import { useRef, type KeyboardEvent } from 'react';
import type { ReactNode } from 'react';

const INDENT = '  ';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  toolbar?: ReactNode;
  minHeight?: number;
}

export const CodeEditor = ({ value, onChange, placeholder, toolbar, minHeight }: CodeEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd } = textarea;
    const next = `${value.slice(0, selectionStart)}${INDENT}${value.slice(selectionEnd)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      textarea.selectionStart = selectionStart + INDENT.length;
      textarea.selectionEnd = selectionStart + INDENT.length;
    });
  };

  return (
    <div className="code-editor">
      {toolbar ? <div className="code-toolbar">{toolbar}</div> : null}
      <textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        spellCheck={false}
        style={minHeight ? { minHeight } : undefined}
        onKeyDown={handleKeyDown}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
};
