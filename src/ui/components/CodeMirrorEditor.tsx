import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { css } from '@codemirror/lang-css';
import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, bracketMatching, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder as placeholderExt } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useEffect, useRef } from 'react';
import type { CodeLanguage } from '@/ui/components/CodeEditor';

/**
 * Los colores salen de las variables del tema, asi que el editor sigue al modo
 * claro/oscuro y al acento sin tener que mantener dos paletas.
 */
const highlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: 'var(--accent-strong)' },
  { tag: [tags.string, tags.special(tags.string)], color: 'var(--success)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--info)' },
  { tag: [tags.comment, tags.lineComment, tags.blockComment], color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: 'var(--warning)' },
  { tag: [tags.propertyName, tags.attributeName], color: 'var(--text)' },
  { tag: tags.operator, color: 'var(--text-secondary)' },
  { tag: tags.invalid, color: 'var(--danger)' },
]);

const theme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: 'var(--text)', fontSize: '11.5px' },
  '.cm-content': { fontFamily: 'var(--font-mono)', padding: '8px 0' },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: 'none',
    fontFamily: 'var(--font-mono)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--surface-hover)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--text-secondary)' },
  '.cm-cursor': { borderLeftColor: 'var(--text)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--accent-soft)',
  },
  '.cm-placeholder': { color: 'var(--text-muted)' },
  '.cm-scroller': { overflow: 'auto', lineHeight: '1.6' },
});

const languageExtension = (language: CodeLanguage): Extension =>
  language === 'css' ? css() : javascript();

interface CodeMirrorEditorProps {
  value: string;
  language: CodeLanguage;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}

const CodeMirrorEditor = ({ value, language, onChange, placeholder, minHeight }: CodeMirrorEditorProps) => {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // El callback vive en un ref para no rearmar el editor en cada render del padre.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  // Idem el doc inicial: se toma una vez y despues lo sincroniza el efecto de abajo,
  // asi tipear no rearma el editor ni pierde cursor e historial.
  const initialValue = useRef(value);

  useEffect(() => {
    if (!host.current) return undefined;

    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          closeBrackets(),
          indentUnit.of('  '),
          syntaxHighlighting(highlight),
          theme,
          languageExtension(language),
          EditorView.lineWrapping,
          ...(placeholder ? [placeholderExt(placeholder)] : []),
          keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });

    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [language, placeholder]);

  /** Solo reescribe el documento si el valor de afuera diverge del editor. */
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current === value) return;
    editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  return <div className="cm-host" ref={host} style={minHeight ? { minHeight } : undefined} />;
};

export default CodeMirrorEditor;
