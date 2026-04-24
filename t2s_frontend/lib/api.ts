export type ApiChat = {
  id: number;
  name: string;
  created_at: string;
};

export type ApiHistoryMessage = {
  id: number;
  message: string;
  description: string | null;
  created_at: string;
};

export type ApiMessageDetail = {
  id: number;
  message: string;
  description?: string | null;
  created_at?: string;
  payload: Record<string, unknown>[];
  sql?: string | null;
};

export type ExportFormat = "xlsx" | "docx" | "pdf";
export type MailingRepeat = "none" | "day" | "week" | "month";

export const MAILING_COMMENT_MAX_LENGTH = 2000;

export type CreateMailingPayload = {
  message_id: number;
  scheduled_at: string;
  repeat: MailingRepeat;
  emails: string[];
  comment?: string;
};

export type CreateMailingResponse = {
  id: number;
  scheduled_at: string;
  repeat: MailingRepeat;
  recipients_count: number;
  periodic_task_name: string;
};

export type ExportFile = {
  blob: Blob;
  fileName: string;
};

export type DatabaseType = "postgresql" | "mysql" | "sqlite";

export type ApiDatabaseConnection = {
  id: number;
  db_type: DatabaseType;
  username: string;
  database_name: string;
  host: string;
  port: number | null;
  sqlite_file: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreateDatabaseConnectionPayload = {
  db_type: DatabaseType;
  username?: string;
  password?: string;
  database_name?: string;
  host?: string;
  port?: number;
  sqlite_file?: File;
};

type UpdateChatPayload = {
  name?: string;
};

const CHAT_API_BASE = "/api/chats";
const USERS_API_BASE = "/api/users";

function trimSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getBackendOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (explicit) return trimSlash(explicit);
  if (typeof window !== "undefined") {
    const { port, origin } = window.location;
    if (port === "3000") return "http://127.0.0.1:80";
    return origin;
  }
  return "http://127.0.0.1:80";
}

function buildUrl(path: string): string {
  const base = `${getBackendOrigin()}${CHAT_API_BASE}`;
  const normalizedPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalizedPath) return `${base}/`;
  return `${base}/${normalizedPath}/`;
}

function buildUsersUrl(path: string): string {
  const base = `${getBackendOrigin()}${USERS_API_BASE}`;
  const normalizedPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalizedPath) return `${base}/`;
  return `${base}/${normalizedPath}/`;
}

async function requestUsersJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUsersUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  return readJsonOrThrow<T>(response);
}

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const bodyText = await response.text();
  let parsed: unknown = null;

  if (bodyText) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = bodyText;
    }
  }

  if (!response.ok) {
    const stringifyIssue = (value: unknown): string => {
      if (value == null) return "";
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      if (Array.isArray(value)) {
        return value.map((item) => stringifyIssue(item)).filter(Boolean).join(", ");
      }
      if (typeof value === "object") {
        return Object.entries(value as Record<string, unknown>)
          .map(([key, val]) => {
            const formatted = stringifyIssue(val);
            return formatted ? `${key}: ${formatted}` : "";
          })
          .filter(Boolean)
          .join("; ");
      }
      return "";
    };

    const message = (() => {
      if (typeof parsed === "object" && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        if ("error" in obj && obj.error != null) {
          const text = stringifyIssue(obj.error);
          if (text) return text;
        }
        if ("detail" in obj && obj.detail != null) {
          const text = stringifyIssue(obj.detail);
          if (text) return text;
        }
        const fieldErrors = stringifyIssue(obj);
        if (fieldErrors) return fieldErrors;
      }
      if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
      return `HTTP ${response.status}`;
    })();
    throw new Error(message);
  }

  return parsed as T;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  return readJsonOrThrow<T>(response);
}

export async function fetchChats(): Promise<ApiChat[]> {
  return requestJson<ApiChat[]>("", { method: "GET" });
}

export async function fetchChat(chatId: number): Promise<ApiChat> {
  return requestJson<ApiChat>(`${chatId}`, { method: "GET" });
}

export async function createChat(name: string): Promise<ApiChat> {
  return requestJson<ApiChat>("", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateChat(chatId: number, payload: UpdateChatPayload): Promise<ApiChat> {
  return requestJson<ApiChat>(`${chatId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteChat(chatId: number): Promise<void> {
  const response = await fetch(buildUrl(`${chatId}`), {
    method: "DELETE",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function fetchChatHistory(chatId: number): Promise<ApiHistoryMessage[]> {
  return requestJson<ApiHistoryMessage[]>(`${chatId}/history`, { method: "GET" });
}

export async function fetchMessageDetail(messageId: number): Promise<ApiMessageDetail> {
  const detail = await requestJson<ApiMessageDetail>(`messages/${messageId}`, { method: "GET" });
  return {
    ...detail,
    payload: Array.isArray(detail.payload) ? detail.payload : [],
  };
}

function inferFileName(contentDisposition: string | null, fallback: string): string {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);
  if (!match?.[1]) return fallback;
  return decodeURIComponent(match[1].replace(/"/g, "").trim());
}

export async function exportMessageFile(messageId: number, fmt: ExportFormat): Promise<ExportFile> {
  const response = await fetch(`${buildUrl(`export/${messageId}`)}?fmt=${fmt}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const blob = await response.blob();
  const fileName = inferFileName(response.headers.get("Content-Disposition"), `message_${messageId}.${fmt}`);
  return { blob, fileName };
}

export async function createMailing(payload: CreateMailingPayload): Promise<CreateMailingResponse> {
  return requestUsersJson<CreateMailingResponse>("mailings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchDatabaseConnections(): Promise<ApiDatabaseConnection[]> {
  return requestJson<ApiDatabaseConnection[]>("db/connect", { method: "GET" });
}

export async function activateDatabaseConnection(id: number): Promise<{ status: string; active_id: number }> {
  return requestJson<{ status: string; active_id: number }>(`db/${id}/activate`, { method: "PATCH" });
}

export async function createDatabaseConnection(payload: CreateDatabaseConnectionPayload): Promise<ApiDatabaseConnection> {
  const body = new FormData();
  body.set("db_type", payload.db_type);

  if (payload.db_type === "sqlite") {
    if (payload.sqlite_file) {
      body.set("sqlite_file", payload.sqlite_file);
    }
  } else {
    if (payload.username) body.set("username", payload.username);
    if (payload.password) body.set("password", payload.password);
    if (payload.database_name) body.set("database_name", payload.database_name);
    if (payload.host) body.set("host", payload.host);
    if (typeof payload.port === "number" && Number.isFinite(payload.port)) body.set("port", String(payload.port));
  }

  const response = await fetch(buildUrl("db/connect"), {
    method: "POST",
    body,
    cache: "no-store",
  });
  return readJsonOrThrow<ApiDatabaseConnection>(response);
}
