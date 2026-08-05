import { Suspense, lazy, useRef, type KeyboardEvent, type ReactNode } from 'react';

const INDENT = '  ';

export type CodeLanguage = 'javascript' | 'css';

/**
 * CodeMirror pesa mas que todo el resto de la UI junta, y el popup tiene que abrir
 * instantaneo. Va en su propio chunk, que se baja recien cuando se muestra un
 * editor; hasta que llega se ve el textarea, que igual es usable.
 */
const CodeMirrorEditor = lazy(() => import('@/ui/components/CodeMirrorEditor'));

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: CodeLanguage;
  placeholder?: string;
  toolbar?: ReactNode;
  minHeight?: number;
}

/** El textarea de siempre: fallback mientras carga el chunk y red de seguridad. */
const PlainEditor = ({
  value,
  onChange,
  placeholder,
  minHeight,
}: Pick<CodeEditorProps, 'value' | 'onChange' | 'placeholder' | 'minHeight'>) => {
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
    <textarea
      ref={textareaRef}
      value={value}
      placeholder={placeholder}
      spellCheck={false}
      style={minHeight ? { minHeight } : undefined}
      onKeyDown={handleKeyDown}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

export const CodeEditor = ({
  value,
  onChange,
  language = 'javascript',
  placeholder,
  toolbar,
  minHeight,
}: CodeEditorProps) => (
  <div className="code-editor">
    {toolbar ? <div className="code-toolbar">{toolbar}</div> : null}
    <Suspense fallback={<PlainEditor value={value} onChange={onChange} placeholder={placeholder} minHeight={minHeight} />}>
      <CodeMirrorEditor
        value={value}
        language={language}
        onChange={onChange}
        placeholder={placeholder}
        minHeight={minHeight}
      />
    </Suspense>
  </div>
);
