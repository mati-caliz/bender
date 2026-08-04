import type { ReactNode } from 'react';

interface ViewShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const ViewShell = ({ title, subtitle, actions, children }: ViewShellProps) => (
  <>
    <header className="view-header">
      <div>
        <h1 className="view-title">{title}</h1>
        {subtitle ? <p className="view-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="view-actions">{actions}</div> : null}
    </header>
    <div className="view-body">{children}</div>
  </>
);
