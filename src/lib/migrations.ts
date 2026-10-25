import { SCHEMA_VERSION } from "@/lib/constants";

type StoredState = Record<string, unknown>;

type Migration = (stored: StoredState) => StoredState;

const MIGRATIONS: Record<number, Migration> = {};

export const migrateStoredState = (stored: StoredState): StoredState => {
  const storedVersion = stored["schemaVersion"];
  let version = typeof storedVersion === "number" ? storedVersion : SCHEMA_VERSION;
  let current = stored;

  while (version < SCHEMA_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) break;
    current = migration(current);
    version += 1;
  }

  return { ...current, schemaVersion: version };
};
