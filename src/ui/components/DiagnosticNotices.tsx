import type { ReactElement } from "react";
import { Notice } from "@/ui/components/primitives";
import type { EngineDiagnostic } from "@/types";

interface DiagnosticNoticesProps {
  diagnostics: EngineDiagnostic[];
}

/** Un aviso por cada diagnóstico del motor, en rojo los errores y en amarillo las advertencias. */
export const DiagnosticNotices = ({ diagnostics }: DiagnosticNoticesProps): ReactElement => (
  <>
    {diagnostics.map((diagnostic, index) => (
      <Notice key={`${diagnostic.message}-${index}`} tone={diagnostic.level === "error" ? "danger" : "warning"}>
        {diagnostic.message}
      </Notice>
    ))}
  </>
);
