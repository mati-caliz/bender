import { useCallback, useEffect, useState } from "react";
import { fetchDesignAudit } from "@/lib/design-audit";
import { errorMessage } from "@/lib/errors";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import type { DesignAudit, DesignCommand, DesignOverlayState, DesignTool } from "@/types";

const OVERLAY_FILE = "content/design-overlay.js";
const INACTIVE_OVERLAY: DesignOverlayState = { active: false, tool: "inspect" };

const AUDIT_UNAVAILABLE_MESSAGE = "Abri una pagina http(s) para analizar su diseño.";

const sendCommand = async (tabId: number, command: DesignCommand): Promise<DesignOverlayState | undefined> =>
  await chrome.tabs.sendMessage<DesignCommand, DesignOverlayState | undefined>(tabId, command);

export interface DesignInspectorController {
  overlay: DesignOverlayState;
  audit: DesignAudit | null;
  loading: boolean;
  error: string | null;
  activate: (tool: DesignTool) => Promise<void>;
  close: () => Promise<void>;
  runAudit: () => void;
}

/** Pregunta a la página en qué quedó el overlay, cada vez que cambia la pestaña o su URL. */
const useOverlayPing = (tabId: number | null, url: string, setOverlay: (state: DesignOverlayState) => void): void => {
  useEffect(() => {
    if (tabId === null) return;
    void sendCommand(tabId, { channel: "bender-design", type: "ping" })
      .then((state) => {
        setOverlay(state ?? INACTIVE_OVERLAY);
      })
      .catch(() => {
        setOverlay(INACTIVE_OVERLAY);
      });
  }, [tabId, url, setOverlay]);
};

export const useDesignInspector = (activeTab: ActiveTab): DesignInspectorController => {
  const [overlay, setOverlay] = useState<DesignOverlayState>(INACTIVE_OVERLAY);
  const [audit, setAudit] = useState<DesignAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tabId = activeTab.id;
  const canInspect = tabId !== null && activeTab.injectable;

  const overlayKey = `${String(tabId)}|${String(activeTab.injectable)}|${activeTab.url}`;
  const [syncedOverlayKey, setSyncedOverlayKey] = useState<string | null>(null);
  if (syncedOverlayKey !== overlayKey) {
    setSyncedOverlayKey(overlayKey);
    if (!canInspect) setOverlay(INACTIVE_OVERLAY);
  }

  const auditKey = `${String(tabId)}|${String(activeTab.injectable)}`;
  const [startedAuditKey, setStartedAuditKey] = useState<string | null>(null);
  if (startedAuditKey !== auditKey) {
    setStartedAuditKey(auditKey);
    if (canInspect) {
      setLoading(true);
      setError(null);
    } else {
      setAudit(null);
      setError(AUDIT_UNAVAILABLE_MESSAGE);
    }
  }

  useOverlayPing(canInspect ? tabId : null, activeTab.url, setOverlay);

  const activate = useCallback(
    async (tool: DesignTool) => {
      if (!canInspect) {
        setError("Abri una pagina http(s) para usar el inspector.");
        return;
      }
      setError(null);
      try {
        await chrome.scripting.executeScript({ target: { tabId, allFrames: false }, files: [OVERLAY_FILE] });
        setOverlay(
          (await sendCommand(tabId, { channel: "bender-design", type: "set-tool", tool })) ??
            INACTIVE_OVERLAY,
        );
      } catch (activationError) {
        setError(errorMessage(activationError, "No se pudo inyectar el inspector en la pagina."));
      }
    },
    [canInspect, tabId],
  );

  const close = useCallback(async () => {
    if (tabId === null) return;
    await sendCommand(tabId, { channel: "bender-design", type: "close" }).catch(() => undefined);
    setOverlay(INACTIVE_OVERLAY);
  }, [tabId]);

  const fetchAudit = useCallback(() => {
    if (!canInspect) return;
    void fetchDesignAudit(tabId)
      .then(setAudit)
      .catch((auditError: unknown) => {
        setAudit(null);
        setError(errorMessage(auditError, "No se pudo analizar la pagina."));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [canInspect, tabId]);

  const runAudit = useCallback(() => {
    if (!canInspect) {
      setAudit(null);
      setError(AUDIT_UNAVAILABLE_MESSAGE);
      return;
    }
    setLoading(true);
    setError(null);
    fetchAudit();
  }, [canInspect, fetchAudit]);

  useEffect(fetchAudit, [fetchAudit]);

  return { overlay, audit, loading, error, activate, close, runAudit };
};
