import type { ReactElement } from "react";

interface CodeEditorStubProps {
  value: string;
  language: string;
  onChange: (value: string) => void;
}

const CodeEditorStub = ({ value, language, onChange }: CodeEditorStubProps): ReactElement => (
  <textarea
    aria-label={`Editor ${language}`}
    value={value}
    onChange={(event) => {
      onChange(event.target.value);
    }}
  />
);

export default CodeEditorStub;
