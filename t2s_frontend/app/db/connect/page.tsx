"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Database,
  Loader2,
  PlugZap,
} from "lucide-react";
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

  const onActivate = useCallback(
    async (id: number) => {
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
    },
    [refresh]
  );

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
        if (Number.isFinite(numericPort) && numericPort > 0) {
          payload.port = numericPort;
        }
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

  const fieldClass =
    "w-full h-11 rounded-[12px] border border-[#D8DDE3] bg-white px-3 text-[14px] text-[#2D2E33] placeholder:text-[#A0A7B4] shadow-sm outline-none transition-all focus:border-[#0B7A73] focus:ring-2 focus:ring-[#0B7A73]/10 sm:h-12 sm:px-4";

  const sectionCardClass =
    "rounded-[18px] border border-[#E3E5E8] bg-[#FCFCFD] p-4 shadow-sm sm:p-5";

  return (
    <main className="min-h-screen bg-[#FBF8FC] px-3 pb-8 pt-4 sm:px-5 sm:pb-10 sm:pt-5 md:px-8 lg:px-10">
      <div className="mx-auto w-full max-w-6xl">
        <button
          type="button"
          onClick={() => router.push("/chat")}
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#0B7A73] shadow-sm transition-all hover:bg-[#F4FFFD] active:scale-[0.99] sm:text-[14px]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
          Назад к чату
        </button>

        <section className="mt-4 rounded-[24px] border border-[#E2DFE6] bg-white p-4 shadow-sm sm:mt-5 sm:p-5 md:p-6 lg:p-7">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#EAF7F5] shadow-sm sm:h-11 sm:w-11">
              <Database className="h-5 w-5 text-[#0B7A73] sm:h-6 sm:w-6" />
            </div>

            <div className="min-w-0">
              <h1 className="font-heading text-[28px] font-bold leading-[1.05] text-[#2D2E33] sm:text-[32px] md:text-[36px]">
                Подключение базы данных
              </h1>
              <p className="mt-2 max-w-[42rem] font-sans text-[13px] leading-5 text-[#8D8D93] sm:text-[14px]">
                Выберите активную БД для генерации SQL и отчетов
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 rounded-[12px] border border-[#F0C4C4] bg-[#FFF5F5] px-4 py-3 text-[13px] text-[#8A2C2C]">
              {error}
            </p>
          )}

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <article className={sectionCardClass}>
              <h2 className="font-heading text-[20px] font-bold leading-tight text-[#0B7A73]">Текущие подключения</h2>

              {loading ? (
                <div className="mt-4 inline-flex items-center gap-2 text-[13px] text-[#8D8D93]">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Загружаю список...
                </div>
              ) : items.length === 0 ? (
                <p className="mt-4 text-[13px] text-[#8D8D93]">Подключений пока нет.</p>
              ) : (
                <div className="mt-4 space-y-3">
                  {items.map((item) => {
                    const activating = activatingId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-[14px] border p-3 shadow-sm sm:p-4 ${
                          item.is_active
                            ? "border-[#BDE7E2] bg-[#F2FBF9]"
                            : "border-[#E0DDE4] bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-[14px] font-semibold leading-5 text-[#2D2E33]">
                              {DB_LABELS[item.db_type]} - {prettyConnectionName(item)}
                            </p>
                            <p className="mt-1 text-[12px] text-[#8D8D93]">
                              {item.is_active ? "Активно сейчас" : "Можно сделать активным"}
                            </p>
                          </div>

                          {item.is_active ? (
                            <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full bg-[#DFF6F2] px-3 py-1.5 font-sans text-[11px] font-semibold text-[#0B7A73] sm:self-start">
                              <Check className="h-3.5 w-3.5 shrink-0" />
                              Активно
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void onActivate(item.id)}
                              disabled={activating}
                              className="inline-flex w-full items-center justify-center rounded-[10px] bg-[#C0EEEA] px-3 py-2 text-[12px] font-semibold text-[#0B7A73] shadow-sm transition-all hover:bg-[#B4E8E3] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
                <p className="mt-4 text-[12px] text-[#6F727B]">
                  Сейчас активна: <span className="font-semibold">{DB_LABELS[activeItem.db_type]}</span>
                </p>
              )}
            </article>

            <article className={sectionCardClass}>
              <h2 className="font-heading text-[20px] font-bold leading-tight text-[#0B7A73]">Добавить подключение</h2>

              <label className="mb-2 mt-4 block font-sans text-[12px] font-semibold tracking-normal text-[#8D8D93]">
                Тип базы
              </label>

              <div className="relative">
                <select
                  value={dbType}
                  onChange={(e) => setDbType(e.target.value as DatabaseType)}
                  className={`${fieldClass} appearance-none pr-10`}
                >
                  <option value="postgresql">PostgreSQL</option>
                  <option value="mysql">MySQL</option>
                  <option value="sqlite">SQLite</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <ChevronDown className="h-4 w-4 text-[#7E8794] sm:h-5 sm:w-5" />
                </div>
              </div>

              {dbType === "sqlite" ? (
                <>
                  <label className="mb-2 mt-4 block font-sans text-[12px] font-semibold tracking-normal text-[#8D8D93]">
                    Файл SQLite
                  </label>
                  <input
                    type="file"
                    accept=".db,.sqlite,.sqlite3"
                    onChange={(e) => setSqliteFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-[13px] text-[#2D2E33] file:mr-3 file:rounded-[10px] file:border-0 file:bg-[#E1F6F3] file:px-3 file:py-2.5 file:text-[12px] file:font-semibold file:text-[#0B7A73] file:shadow-sm"
                  />
                </>
              ) : (
                <div className="mt-4 grid gap-3">
                  <input
                    placeholder="Хост"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className={fieldClass}
                  />
                  <input
                    placeholder="Порт (опционально)"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className={fieldClass}
                  />
                  <input
                    placeholder="Имя базы"
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                    className={fieldClass}
                  />
                  <input
                    placeholder="Логин"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className={fieldClass}
                  />
                  <input
                    type="password"
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={fieldClass}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => void onCreate()}
                disabled={saving}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#0B7A73] px-4 py-3 text-[14px] font-semibold text-white shadow-sm transition-all hover:bg-[#09665F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                ) : (
                  <PlugZap className="h-4 w-4 shrink-0" />
                )}
                {saving ? "Подключаю..." : "Подключить и сделать активной"}
              </button>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}