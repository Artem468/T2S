function trimSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toWsProtocol(protocol: string): string {
  return protocol === "https:" ? "wss:" : "ws:";
}

export function getChatWebSocketUrl(): string {
  const explicitWs = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (explicitWs) {
    return `${trimSlash(explicitWs)}/ws/chat/`;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (apiBase) {
    const u = new URL(apiBase);
    return `${toWsProtocol(u.protocol)}//${u.host}/ws/chat/`;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname, port, host } = window.location;
    if (port === "3000") {
      return `${toWsProtocol(protocol)}//${hostname}/ws/chat/`;
    }
    return `${toWsProtocol(protocol)}//${host}/ws/chat/`;
  }

  return "ws://localhost/ws/chat/";
}
