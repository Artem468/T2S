"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Database, Loader2, PlugZap } from "lucide-react";
import {
  activateDatabaseConnection,
  createDatabaseConnection,
  fetchDatabaseConnections,
  type ApiDatabaseConnection,
  type CreateDatabaseConnectionPayload,
  type DatabaseType,
} from "@/lib/api";

const DB_LABELS: Record<DatabaseType, string> = {
  postgresql: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

function prettyConnectionName(item: ApiDatabaseConnection): string {
  if (item.db_type === "sqlite") {
    return item.sqlite_file || "SQLite файл";
  }
  const host = item.host || "host";
  const port = item.port ? `:${item.port}` : "";
  const dbName = item.database_name ? `/${item.database_name}` : "";
  return `${host}${port}${dbName}`;
}

export default function DatabaseConnectPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApiDatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [dbType, setDbType] = useState<DatabaseType>("postgresql");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [databaseName, setDatabaseName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [sqliteFile, setSqliteFile] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchDatabaseConnections();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить подключения");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refresh]);

  const activeItem = useMemo(() => items.find((x) => x.is_active) ?? null, [items]);

  const onActivate = useCallback(async (id: number) => {
    setActivatingId(id);
    setError(null);
    try {
      await activateDatabaseConnection(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось активировать подключение");
    } finally {
      setActivatingId(null);
    }
  }, [refresh]);

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setDatabaseName("");
    setHost("");
    setPort("");
    setSqliteFile(null);
  };

  const onCreate = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: CreateDatabaseConnectionPayload = { db_type: dbType };
      if (dbType === "sqlite") {
        if (!sqliteFile) {
          setError("Для SQLite выберите файл .db");
          setSaving(false);
          return;
        }
        payload.sqlite_file = sqliteFile;
      } else {
        payload.username = username.trim();
        payload.password = password;
        payload.database_name = databaseName.trim();
        payload.host = host.trim();
        const numericPort = Number(port);
        if (Number.isFinite(numericPort) && numericPort > 0) payload.port = numericPort;
      }
      await createDatabaseConnection(payload);
      resetForm();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить подключение");
    } finally {
      setSaving(false);
    }
  }, [databaseName, dbType, host, password, port, refresh, sqliteFile, username]);

  return (
    <main className="min-h-screen bg-[#FBF8FC] px-5 pb-12 pt-6 md:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0b7a73] shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-colors hover:bg-[#f5fffd]"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад к чату
        </button>

        <section className="mt-5 rounded-[24px] border border-[#e2dfe6] bg-white p-5 shadow-[0_6px_20px_rgba(0,0,0,0.05)] md:p-6">
          <div className="flex items-center gap-3">
            <Database className="h-6 w-6 text-[#0b7a73]" />
            <div>
              <h1 className="font-[var(--font-futuraround)] text-[26px] font-bold uppercase text-[#2d2e33]">
                Подключение базы данных
              </h1>
              <p className="mt-1 text-[13px] text-[#8d8d93]">Выберите активную БД для генерации SQL и отчетов</p>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-[12px] border border-[#f0c4c4] bg-[#fff5f5] px-4 py-3 text-[13px] text-[#8a2c2c]">
              {error}
            </p>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <article className="rounded-[16px] border border-[#e0dde4] bg-[#faf9fb] p-4">
              <h2 className="text-[16px] font-bold uppercase text-[#0b7a73]">Текущие подключения</h2>
              {loading ? (
                <div className="mt-4 inline-flex items-center gap-2 text-[13px] text-[#8d8d93]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загружаю список...
                </div>
              ) : items.length === 0 ? (
                <p className="mt-4 text-[13px] text-[#8d8d93]">Подключений пока нет.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {items.map((item) => {
                    const activating = activatingId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-[12px] border px-3 py-3 ${
                          item.is_active ? "border-[#bde7e2] bg-[#f2fbf9]" : "border-[#e0dde4] bg-white"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#2d2e33]">
                              {DB_LABELS[item.db_type]} - {prettyConnectionName(item)}
                            </p>
                            <p className="mt-1 text-[12px] text-[#8d8d93]">
                              {item.is_active ? "Активно сейчас" : "Можно сделать активным"}
                            </p>
                          </div>
                          {item.is_active ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#dff6f2] px-2 py-1 text-[11px] font-semibold text-[#0b7a73]">
                              <Check className="h-3.5 w-3.5" />
                              Активно
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void onActivate(item.id)}
                              disabled={activating}
                              className="rounded-[9px] bg-[#c0eeea] px-3 py-1.5 text-[12px] font-semibold text-[#0b7a73] hover:bg-[#b4e8e3] disabled:opacity-60"
                            >
                              {activating ? "..." : "Активировать"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {activeItem && (
                <p className="mt-4 text-[12px] text-[#6f727b]">
                  Сейчас активна: <span className="font-semibold">{DB_LABELS[activeItem.db_type]}</span>
                </p>
              )}
            </article>

            <article className="rounded-[16px] border border-[#e0dde4] bg-[#faf9fb] p-4">
              <h2 className="text-[16px] font-bold uppercase text-[#0b7a73]">Добавить подключение</h2>

              <label className="mt-4 block text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8d8d93]">
                Тип базы
              </label>
              <select
                value={dbType}
                onChange={(e) => setDbType(e.target.value as DatabaseType)}
                className="mt-1 w-full rounded-[10px] border border-[#d9d5dd] bg-white px- py-2.5 text-[14px] text-[#2d2e33] outline-none focus:border-[#0b7a73]"
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlite">SQLite</option>
              </select>

              {dbType === "sqlite" ? (
                <>
                  <label className="mt-4 block text-[12px] font-semibold uppercase tracking-[0.05em] text-[#8d8d93]">
                    Файл SQLite
                  </label>
                  <input
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    onChange={(e) => setSqliteFile(e.target.files?.[0] ?? null)}
                    className="mt-1 block w-full text-[13px] text-[#2d2e33] file:mr-3 file:rounded-[9px] file:border-0 file:bg-[#e1f6f3] file:px-3 file:py-2 file:text-[12px] file:font-semibold file:text-[#0b7a73]"
                  />
                </>
              ) : (
                <div className="mt-4 grid gap-3">
                  <input
                    placeholder="Хост"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full rounded-[10px] border border-[#d9d5dd] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#0b7a73]"
                  />
                  <input
                    placeholder="Порт (опционально)"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full rounded-[10px] border border-[#d9d5dd] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#0b7a73]"
                  />
                  <input
                    placeholder="Имя базы"
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                    className="w-full rounded-[10px] border border-[#d9d5dd] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#0b7a73]"
                  />
                  <input
                    placeholder="Логин"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-[10px] border border-[#d9d5dd] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#0b7a73]"
                  />
                  <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[10px] border border-[#d9d5dd] bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#0b7a73]"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => void onCreate()}
                disabled={saving}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#0b7a73] py-3 text-[14px] font-semibold text-white shadow-[0_6px_16px_rgba(11,122,115,0.25)] transition-colors hover:bg-[#09665f] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                {saving ? "Подключаю..." : "Подключить и сделать активной"}
              </button>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
