import { useCallback, useEffect, useState } from 'react';
import { MAX_AUDITED_ELEMENTS, MAX_AUDIT_RESULTS, auditPageDesign } from '@/lib/design-audit';
import { errorMessage } from '@/lib/errors';
import type { ActiveTab } from '@/ui/hooks/useActiveTab';
import type { DesignAudit, DesignCommand, DesignOverlayState, DesignTool } from '@/types';

const OVERLAY_FILE = 'content/design-overlay.js';
const INACTIVE_OVERLAY: DesignOverlayState = { active: false, tool: 'inspect' };

const sendCommand = async (tabId: number, command: DesignCommand): Promise<DesignOverlayState> =>
  (await chrome.tabs.sendMessage(tabId, command)) as DesignOverlayState;

export interface DesignInspectorController {
  overlay: DesignOverlayState;
  audit: DesignAudit | null;
  loading: boolean;
  error: string | null;
  activate: (tool: DesignTool) => Promise<void>;
  close: () => Promise<void>;
  runAudit: () => void;
}

export const useDesignInspector = (activeTab: ActiveTab): DesignInspectorController => {
  const [overlay, setOverlay] = useState<DesignOverlayState>(INACTIVE_OVERLAY);
  const [audit, setAudit] = useState<DesignAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabId = activeTab.id;

  useEffect(() => {
    if (tabId === null || !activeTab.injectable) {
      setOverlay(INACTIVE_OVERLAY);
      return;
    }
    void sendCommand(tabId, { channel: 'bender-design', type: 'ping' })
      .then((state) => setOverlay(state ?? INACTIVE_OVERLAY))
      .catch(() => setOverlay(INACTIVE_OVERLAY));
  }, [tabId, activeTab.injectable, activeTab.url]);

  const activate = useCallback(
    async (tool: DesignTool) => {
      if (tabId === null || !activeTab.injectable) {
        setError('Abri una pagina http(s) para usar el inspector.');
        return;
      }
      setError(null);
      try {
        await chrome.scripting.executeScript({ target: { tabId, allFrames: false }, files: [OVERLAY_FILE] });
        setOverlay(await sendCommand(tabId, { channel: 'bender-design', type: 'set-tool', tool }));
      } catch (activationError) {
        setError(errorMessage(activationError, 'No se pudo inyectar el inspector en la pagina.'));
      }
    },
    [activeTab.injectable, tabId]
  );

  const close = useCallback(async () => {
    if (tabId === null) return;
    await sendCommand(tabId, { channel: 'bender-design', type: 'close' }).catch(() => undefined);
    setOverlay(INACTIVE_OVERLAY);
  }, [tabId]);

  const runAudit = useCallback(() => {
    if (tabId === null || !activeTab.injectable) {
      setAudit(null);
      setError('Abri una pagina http(s) para analizar su diseño.');
      return;
    }
    setLoading(true);
    setError(null);
    void chrome.scripting
      .executeScript({
        target: { tabId },
        func: auditPageDesign,
        args: [MAX_AUDITED_ELEMENTS, MAX_AUDIT_RESULTS],
      })
      .then((results) => setAudit(results[0]?.result ?? null))
      .catch((auditError: unknown) => {
        setAudit(null);
        setError(errorMessage(auditError, 'No se pudo analizar la pagina.'));
      })
      .finally(() => setLoading(false));
  }, [activeTab.injectable, tabId]);

  useEffect(runAudit, [runAudit]);

  return { overlay, audit, loading, error, activate, close, runAudit };
};
