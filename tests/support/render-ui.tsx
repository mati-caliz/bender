import { render, type RenderResult } from "@testing-library/react";
import { useState, type ReactElement, type ReactNode } from "react";
import { vi } from "vitest";
import { createDefaultState } from "@/lib/constants";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";
import { ToastProvider } from "@/ui/hooks/useToasts";
import type { UpdateState } from "@/ui/views/types";
import type { ToolkitState } from "@/types";

export const EMPTY_ACTIVE_TAB: ActiveTab = { id: null, url: "", origin: "", hostname: "", injectable: false };

export const activeTabFor = (url: string, id = 7): ActiveTab => {
  const parsed = new URL(url);
  return { id, url, origin: parsed.origin, hostname: parsed.hostname, injectable: true };
};

export const renderWithToasts = (ui: ReactNode): RenderResult => render(<ToastProvider>{ui}</ToastProvider>);

export interface StatefulRender extends RenderResult {
  currentState: () => ToolkitState;
  updateSpy: ReturnType<typeof vi.fn<UpdateState>>;
}

interface StatefulHostProps {
  initialState: ToolkitState;
  onState: (state: ToolkitState) => void;
  updateSpy: UpdateState;
  renderView: (state: ToolkitState, update: UpdateState) => ReactElement;
}

const StatefulHost = ({ initialState, onState, updateSpy, renderView }: StatefulHostProps): ReactElement => {
  const [state, setState] = useState(initialState);
  const update: UpdateState = (mutate) => {
    updateSpy(mutate);
    setState((current) => {
      const next = mutate(current);
      onState(next);
      return next;
    });
  };
  return renderView(state, update);
};

export const renderStateful = (
  renderView: (state: ToolkitState, update: UpdateState) => ReactElement,
  initialState: ToolkitState = createDefaultState(),
): StatefulRender => {
  let latest = initialState;
  const updateSpy = vi.fn<UpdateState>();
  const result = renderWithToasts(
    <StatefulHost
      initialState={initialState}
      onState={(next) => {
        latest = next;
      }}
      updateSpy={updateSpy}
      renderView={renderView}
    />,
  );
  return { ...result, currentState: () => latest, updateSpy };
};
