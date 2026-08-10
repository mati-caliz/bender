import { useState } from 'react';
import { IMPORT_PARAM } from '@/lib/constants';
import type { ViewId } from '@/ui/App';

export const readPendingImportView = (): string | null =>
  new URLSearchParams(window.location.search).get(IMPORT_PARAM);

export const usePendingImport = (viewId: ViewId): [boolean, (open: boolean) => void] => {
  const [importing, setImporting] = useState(() => readPendingImportView() === viewId);
  return [importing, setImporting];
};
