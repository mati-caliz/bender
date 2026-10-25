import type { ReactElement, ReactNode } from "react";
import { hasRenderableNode, hasText } from "@/ui/components/render-guards";

interface ViewShellProps {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode;
  children: ReactNode;
}

export const ViewShell = ({ title, subtitle, actions, children }: ViewShellProps): ReactElement => (
  <>
    <header className="view-header">
      <div>
        <h1 className="view-title">{title}</h1>
        {hasText(subtitle) ? <p className="view-subtitle">{subtitle}</p> : null}
      </div>
      {hasRenderableNode(actions) ? <div className="view-actions">{actions}</div> : null}
    </header>
    <div className="view-body">{children}</div>
  </>
);
