import { useRef, useState, type DragEvent } from 'react';
import { IMPORT_PARAM, SURFACE_PARAM } from '@/lib/constants';
import { readFileAsText } from '@/lib/download';
import { errorMessage } from '@/lib/errors';
import type { ViewId } from '@/ui/App';
import { Button, Dialog, Notice } from '@/ui/components/primitives';

export type ImportMode = 'replace' | 'append';

interface ImportDialogProps {
  title: string;
  description: string;
  viewId: ViewId;
  allowAppend?: boolean;
  onClose: () => void;
  onImport: (text: string, mode: ImportMode) => void;
}

export const ImportDialog = ({
  title,
  description,
  viewId,
  allowAppend = true,
  onClose,
  onImport,
}: ImportDialogProps) => {
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
      setError(errorMessage(importError, 'No se pudo importar.'));
    }
  };

  const openInTab = () => {
    const url = chrome.runtime.getURL(`index.html?${SURFACE_PARAM}=tab&${IMPORT_PARAM}=${viewId}`);
    void chrome.tabs.create({ url });
    window.close();
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
            <Button onClick={() => submit('append')} icon="plus" title="No toca lo que no venga en el archivo">
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
        <Button icon="upload" onClick={isPopup ? openInTab : () => fileInputRef.current?.click()}>
          {isPopup ? 'Elegir archivo en una pestaña' : 'Elegir archivo'}
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
          Chrome cierra el popup apenas se abre el selector de archivos y se pierde lo que hayas cargado. Con el boton
          de arriba seguis el import en una pestaña, o pega el JSON aca mismo.
        </Notice>
      ) : null}
    </Dialog>
  );
};
