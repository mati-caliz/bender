import { useState } from "react";
import type { ReactElement } from "react";
import { Button, Card, TextInput } from "@/ui/components/primitives";
import type { useToasts } from "@/ui/hooks/useToasts";
import type { CookiesController } from "@/ui/hooks/useCookies";
import type { ActiveTab } from "@/ui/hooks/useActiveTab";

interface CookieSnapshotsCardProps {
  cookies: CookiesController;
  activeTab: ActiveTab;
  notify: ReturnType<typeof useToasts>["notify"];
}

export const CookieSnapshotsCard = ({
  cookies,
  activeTab,
  notify,
}: CookieSnapshotsCardProps): ReactElement => {
  const [snapshotName, setSnapshotName] = useState("");
  return (
    <Card
      title="Snapshots"
      subtitle="Guarda el set completo de cookies del dominio y volve a el de un click."
    >
      <div className="toolbar">
        <TextInput
          value={snapshotName}
          placeholder="Nombre del snapshot (admin, user readonly…)"
          onChange={setSnapshotName}
        />
        <Button
          small
          icon="plus"
          disabled={!snapshotName.trim() || cookies.liveCookies.length === 0}
          onClick={() => {
            const name = snapshotName.trim();
            void cookies.saveSnapshotSet(name).then(() => {
              notify(`Snapshot "${name}" guardado`, "success");
            });
            setSnapshotName("");
          }}
        >
          Guardar actual
        </Button>
      </div>

      {cookies.snapshotSets.length > 0 ? (
        <div className="list" style={{ marginTop: 8 }}>
          {cookies.snapshotSets.map((set) => (
            <div key={set.id} className="row" style={{ gap: 8, padding: "6px 0" }}>
              <strong className="text-small">{set.name}</strong>
              <span className="text-small text-muted">
                {set.cookies.length} cookie(s) · {new Date(set.createdAt).toLocaleString()}
              </span>
              <div className="spacer" />
              <Button
                small
                icon="refresh"
                disabled={!activeTab.injectable}
                onClick={() =>
                  void cookies.restoreSnapshotSet(set).then(() => {
                    notify(`Snapshot "${set.name}" restaurado`, "success");
                  })
                }
              >
                Restaurar
              </Button>
              <Button
                small
                variant="danger"
                icon="trash"
                onClick={() =>
                  void cookies.deleteSnapshotSet(set.id).then(() => {
                    notify("Snapshot borrado");
                  })
                }
              >
                Borrar
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-small text-muted" style={{ margin: 0 }}>
          Todavia no guardaste ninguno. Restaurar borra las cookies actuales del dominio y escribe las del
          snapshot.
        </p>
      )}
    </Card>
  );
};
