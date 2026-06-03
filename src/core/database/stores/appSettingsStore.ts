import type Database from 'better-sqlite3';

export interface IAppSettingsStore {
  get(key: string): string | null;
  getJson<T>(key: string): T | null;
  set(key: string, value: string): void;
  setJson(key: string, value: unknown): void;
  delete(key: string): void;
  getAll(): Record<string, string>;
  setMany(entries: Record<string, string>): void;
}

export function createAppSettingsStore(db: Database.Database): IAppSettingsStore {
  const getStmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const setStmt = db.prepare(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
  );
  const deleteStmt = db.prepare('DELETE FROM app_settings WHERE key = ?');
  const getAllStmt = db.prepare('SELECT key, value FROM app_settings');

  return {
    get(key: string): string | null {
      const row = getStmt.get(key) as { value: string } | undefined;
      return row?.value ?? null;
    },

    getJson<T>(key: string): T | null {
      const raw = this.get(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },

    set(key: string, value: string): void {
      setStmt.run(key, value);
    },

    setJson(key: string, value: unknown): void {
      setStmt.run(key, JSON.stringify(value));
    },

    delete(key: string): void {
      deleteStmt.run(key);
    },

    getAll(): Record<string, string> {
      const rows = getAllStmt.all() as Array<{ key: string; value: string }>;
      const result: Record<string, string> = {};
      for (const row of rows) {
        result[row.key] = row.value;
      }
      return result;
    },

    setMany(entries: Record<string, string>): void {
      db.transaction(() => {
        for (const [key, value] of Object.entries(entries)) {
          setStmt.run(key, value);
        }
      })();
    },
  };
}
