import type { ReactElement } from "react";
import { PLACEHOLDERS } from "@/lib/placeholders";
import { Icon } from "@/ui/components/Icon";

export const HeaderHints = (): ReactElement => (
  <>
    <details className="hint-card">
      <summary>
        <Icon name="info" size={13} />
        Valores dinamicos
      </summary>
      <div className="hint-body">
        <p className="text-small text-muted" style={{ margin: "0 0 8px" }}>
          En el valor de un header podes escribir estos marcadores. Se resuelven cuando el motor recompila las
          reglas (al guardar un cambio, al cambiar de pestaña o al arrancar el navegador), no en cada request.
        </p>
        <div style={{ display: "grid", gap: 4 }}>
          {PLACEHOLDERS.map((placeholder) => (
            <div key={placeholder.name} className="row" style={{ gap: 8 }}>
              <code className="text-small">{`{{${placeholder.name}}}`}</code>
              <span className="text-small text-muted">{placeholder.description}</span>
            </div>
          ))}
        </div>
      </div>
    </details>

    <details className="hint-card">
      <summary>
        <Icon name="info" size={13} />
        Como se resuelven los conflictos
      </summary>
      <p className="text-small text-muted" style={{ margin: 0 }}>
        Si dos perfiles activos tocan el mismo header, gana el que este mas abajo en la lista de perfiles. Los
        headers de la pestaña User-Agent y de CORS tienen prioridad sobre los perfiles.
      </p>
    </details>
  </>
);
