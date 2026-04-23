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

type UpdateChatPayload = {
  name?: string;
};

const CHAT_API_BASE = "/api/chats";

function trimSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getBackendOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (explicit) return trimSlash(explicit);
  if (typeof window !== "undefined") {
    const { port, origin } = window.location;
    if (port === "3000") return "";
    return origin;
  }
  return "";
}

function buildUrl(path: string): string {
  const base = `${getBackendOrigin()}${CHAT_API_BASE}`;
  const normalizedPath = path.replace(/^\/+/, "").replace(/\/+$/, "");
  if (!normalizedPath) return base;
  return `${base}/${normalizedPath}`;
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
    const message =
      typeof parsed === "object" && parsed !== null && "error" in parsed
        ? String((parsed as { error?: unknown }).error ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
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
