import { useRef, useState, type DragEvent } from 'react';
import { readFileAsText } from '@/lib/download';
import { Button, Dialog, Notice } from '@/ui/components/primitives';

export type ImportMode = 'replace' | 'append';

interface ImportDialogProps {
  title: string;
  description: string;
  allowAppend?: boolean;
  onClose: () => void;
  onImport: (text: string, mode: ImportMode) => void;
}

export const ImportDialog = ({ title, description, allowAppend = true, onClose, onImport }: ImportDialogProps) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPopup = document.body.dataset.surface === 'popup';

  const submit = (mode: ImportMode) => {
    if (!text.trim()) {
      setError('Pega el JSON o elegi un archivo.');
      return;
    }
    try {
      onImport(text, mode);
      onClose();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'No se pudo importar.');
    }
  };

  const handleDrop = (event: DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) void readFileAsText(file).then(setText);
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {allowAppend ? (
            <Button onClick={() => submit('append')} icon="plus">
              Agregar a lo actual
            </Button>
          ) : null}
          <Button variant="primary" icon="download" onClick={() => submit('replace')}>
            {allowAppend ? 'Reemplazar todo' : 'Importar'}
          </Button>
        </>
      }
    >
      <p className="text-secondary text-small" style={{ margin: 0 }}>
        {description}
      </p>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <textarea
        className="textarea mono"
        value={text}
        rows={10}
        placeholder='[{ "name": "Local", "requestHeaders": [{ "name": "X-Debug", "value": "true" }] }]'
        onChange={(event) => setText(event.target.value)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
      />

      <div className="row">
        <Button
          icon="upload"
          onClick={() => fileInputRef.current?.click()}
        >
          Elegir archivo
        </Button>
        <span className="field-hint">Tambien podes arrastrar el archivo sobre el cuadro.</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFileAsText(file).then(setText);
          }}
        />
      </div>

      {isPopup ? (
        <Notice>
          Si el selector de archivos cierra el popup, abri Bender en el panel lateral o en una pestaña con los botones
          de arriba a la derecha.
        </Notice>
      ) : null}
    </Dialog>
  );
};
