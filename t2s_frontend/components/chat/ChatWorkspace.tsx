"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatDashboardView, type DashboardPhase } from "@/components/chat/ChatDashboardView";
import { normalizeBarPercents, pickNumericSeries, pieAngleFromRatio, pieTwoParts } from "@/components/chat/chartFromRows";
import {
  createChat,
  deleteChat,
  fetchChat,
  fetchChatHistory,
  fetchChats,
  fetchMessageDetail,
  updateChat,
  type ApiChat,
  type ApiHistoryMessage,
} from "@/lib/api";
import { getChatWebSocketUrl } from "@/lib/ws";

type WsPayload = {
  type?: string;
  text?: string;
  description?: string;
  chat_id?: number;
  payload?: Record<string, unknown>[];
  chart?: {
    bars?: { label: string; value: number }[];
    pie?: { segments?: { label: string; value: number }[] };
  };
};

const LOG = "[T2S WS]";

function logWs(...args: unknown[]) {
  console.info(LOG, ...args);
}

export function ChatWorkspace() {
  const wsRef = useRef<WebSocket | null>(null);
  const bootRef = useRef(false);
  const inFlightRef = useRef(false);
  const chatIdRef = useRef<number | null>(null);
  const expandedChatIdRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<DashboardPhase>("idle");
  const [draft, setDraft] = useState("");
  const [userBubble, setUserBubble] = useState("");
  const [chatId, setChatId] = useState<number | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [sqlText, setSqlText] = useState<string | null>(null);
  const [sqlCopyText, setSqlCopyText] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [hasSql, setHasSql] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [wsChart, setWsChart] = useState<NonNullable<WsPayload["chart"]> | null>(null);
  const [chats, setChats] = useState<ApiChat[]>([]);
  /** История USER-сообщений по id чата (хронологически: старые → новые) */
  const [chatHistories, setChatHistories] = useState<Record<number, ApiHistoryMessage[]>>({});
  /** Какой чат в сайдбаре раскрыт и показывает подчаты */
  const [expandedChatId, setExpandedChatId] = useState<number | null>(null);
  const [selectedQueryMessageId, setSelectedQueryMessageId] = useState<number | null>(null);
  const [newChatPending, setNewChatPending] = useState(false);
  const [chatSwitchPending, setChatSwitchPending] = useState(false);

  const refreshChats = useCallback(async () => {
    try {
      const list = await fetchChats();
      setChats(list);
    } catch (e) {
      logWs("fetchChats failed", e);
    }
  }, []);

  const mergeChatHistory = useCallback(async (id: number) => {
    try {
      const h = await fetchChatHistory(id);
      const chronological = [...h].reverse();
      setChatHistories((prev) => ({ ...prev, [id]: chronological }));
      return chronological;
    } catch (e) {
      logWs("fetchChatHistory failed", e);
      setChatHistories((prev) => ({ ...prev, [id]: [] }));
      return [] as ApiHistoryMessage[];
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void refreshChats();
    }, 0);
    return () => window.clearTimeout(id);
  }, [refreshChats]);

  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  useEffect(() => {
    expandedChatIdRef.current = expandedChatId;
  }, [expandedChatId]);

  useEffect(() => {
    if (chatId == null) return;
    const id = window.setTimeout(() => {
      void mergeChatHistory(chatId);
    }, 0);
    return () => window.clearTimeout(id);
  }, [chatId, mergeChatHistory]);

  const clearMainPanel = useCallback(() => {
    setPhase("idle");
    setUserBubble("");
    setHasSql(false);
    setHasData(false);
    setSqlText(null);
    setSqlCopyText(null);
    setRows([]);
    setWsChart(null);
    setSummaryText("");
    setErrorMessage(null);
    setSelectedQueryMessageId(null);
  }, []);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      logWs("close()", "readyState=", wsRef.current.readyState);
    }
    wsRef.current?.close();
    wsRef.current = null;
    inFlightRef.current = false;
  }, []);

  const applyWsMessage = useCallback((raw: string) => {
    logWs("message raw length=", raw.length, "preview=", raw.slice(0, 200));
    let data: WsPayload;
    try {
      data = JSON.parse(raw) as WsPayload;
    } catch (e) {
      logWs("JSON.parse failed", e);
      return;
    }
    logWs("parsed type=", data.type, "chat_id=", data.chat_id);
    if (data.type === "sql") {
      if (typeof data.chat_id === "number") {
        setChatId(data.chat_id);
        setExpandedChatId(data.chat_id);
        void mergeChatHistory(data.chat_id);
      }
      // Бэкенд: text = SQL, description = русское объяснение (не наоборот)
      const sql = typeof data.text === "string" ? data.text : null;
      const narrative = typeof data.description === "string" ? data.description : "";
      setSqlText(sql);
      setSqlCopyText(sql);
      setSummaryText(narrative);
      setHasSql(true);
      void refreshChats();
    }
    if (data.type === "data" && Array.isArray(data.payload)) {
      setRows(data.payload as Record<string, unknown>[]);
      setWsChart(data.chart && typeof data.chart === "object" ? data.chart : null);
      setHasData(true);
      setPhase("ready");
      void refreshChats();
      if (typeof data.chat_id === "number") void mergeChatHistory(data.chat_id);
      queueMicrotask(() => {
        const s = wsRef.current;
        wsRef.current = null;
        inFlightRef.current = false;
        logWs("closing after data");
        s?.close();
      });
    }
    if (data.type === "error") {
      logWs("server error payload", data.text);
      setErrorMessage(data.text ?? "Ошибка");
      if (typeof data.chat_id === "number") void mergeChatHistory(data.chat_id);
      const s = wsRef.current;
      wsRef.current = null;
      inFlightRef.current = false;
      s?.close();
    }
  }, [mergeChatHistory, refreshChats]);

  const connectAndSend = useCallback(
    (text: string) => {
      if (inFlightRef.current) {
        logWs("skip connect: request already in flight");
        return;
      }
      closeWs();
      inFlightRef.current = true;
      setErrorMessage(null);
      setHasSql(false);
      setHasData(false);
      setSqlText(null);
      setSqlCopyText(null);
      setRows([]);
      setWsChart(null);
      setSummaryText("");
      setPhase("loading");
      setSelectedQueryMessageId(null);
      void refreshChats();

      const url = getChatWebSocketUrl();
      logWs("connecting", url, "chatId=", chatId);
      const ws = new WebSocket(url);
      wsRef.current = ws;
      logWs("WebSocket constructed readyState=", ws.readyState, "(0=CONNECTING)");

      ws.onopen = () => {
        logWs("open readyState=", ws.readyState);
        const out: { text: string; chat_id?: number } = { text };
        if (chatId != null) out.chat_id = chatId;
        const body = JSON.stringify(out);
        logWs("send", body.length > 500 ? body.slice(0, 500) + "…" : body);
        ws.send(body);
        const idAfterSend = chatIdRef.current;
        if (idAfterSend != null) {
          queueMicrotask(() => void mergeChatHistory(idAfterSend));
        }
      };
      ws.onmessage = (ev) => applyWsMessage(String(ev.data));
      ws.onerror = (ev) => {
        logWs("onerror", ev.type, "readyState=", ws.readyState);
        setErrorMessage("Не удалось подключиться к серверу");
        inFlightRef.current = false;
        wsRef.current = null;
        ws.close();
      };
      ws.onclose = (ev) => {
        logWs("onclose code=", ev.code, "reason=", ev.reason || "(empty)", "wasClean=", ev.wasClean);
        inFlightRef.current = false;
        if (wsRef.current === ws) wsRef.current = null;
        void refreshChats();
        const cid = chatIdRef.current;
        const eid = expandedChatIdRef.current;
        const seen = new Set<number>();
        if (cid != null) {
          seen.add(cid);
          void mergeChatHistory(cid);
        }
        if (eid != null && !seen.has(eid)) void mergeChatHistory(eid);
      };
    },
    [applyWsMessage, chatId, closeWs, mergeChatHistory, refreshChats]
  );

  useEffect(() => () => closeWs(), [closeWs]);

  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    const pending = sessionStorage.getItem("t2s:pendingText");
    if (!pending?.trim()) return;
    sessionStorage.removeItem("t2s:pendingText");
    const q = pending.trim();
    const id = window.setTimeout(() => {
      setUserBubble(q);
      logWs("bootstrap from sessionStorage, len=", q.length);
      connectAndSend(q);
    }, 0);
    return () => window.clearTimeout(id);
  }, [connectAndSend]);

  useEffect(() => {
    if (phase !== "loading" || errorMessage) return;
    const id = window.setInterval(() => setPhraseIndex((i) => i + 1), 2800);
    return () => window.clearInterval(id);
  }, [phase, errorMessage]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    if ((phase === "loading" && !errorMessage) || inFlightRef.current) return;
    setUserBubble(text);
    setDraft("");
    connectAndSend(text);
  };

  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const nums = pickNumericSeries(rows);

  const barPercents = useMemo(() => {
    const bars = wsChart?.bars;
    if (bars?.length) {
      const vals = bars.map((b) => b.value);
      return normalizeBarPercents(vals);
    }
    return normalizeBarPercents(nums.length ? nums : [40, 55, 70, 50, 65]);
  }, [wsChart, nums]);

  const { pieA, pieB, pieAngle } = useMemo(() => {
    const segs = wsChart?.pie?.segments;
    if (segs && segs.length >= 2) {
      const a = segs[0].value;
      const b = segs[1].value;
      return { pieA: a, pieB: b, pieAngle: pieAngleFromRatio(a, b) };
    }
    const { a: pa, b: pb } = pieTwoParts(nums.length ? nums : [14, 3]);
    return { pieA: pa, pieB: pb, pieAngle: pieAngleFromRatio(pa, pb) };
  }, [wsChart, nums]);

  const sendDisabled = phase === "loading" && !errorMessage;

  const sidebarChats = useMemo(
    () =>
      chats.map((c) => {
        const list = chatHistories[c.id] ?? [];
        return {
          id: c.id,
          title: c.name,
          active: chatId === c.id,
          expanded: expandedChatId === c.id,
          queries: list.map((m) => ({
            id: m.id,
            text: m.message,
          })),
        };
      }),
    [chats, chatId, expandedChatId, chatHistories]
  );

  const handleSelectChat = useCallback(
    async (id: number) => {
      if (expandedChatId === id) {
        setExpandedChatId(null);
        return;
      }
      setChatSwitchPending(true);
      try {
        const chat = await fetchChat(id);
        setChats((prev) => prev.map((x) => (x.id === id ? { ...x, ...chat } : x)));
      } catch (e) {
        logWs("fetchChat failed", e);
        setErrorMessage("Не удалось загрузить чат");
        setChatSwitchPending(false);
        return;
      }
      setChatId(id);
      setSelectedQueryMessageId(null);
      setExpandedChatId(id);
      try {
        await mergeChatHistory(id);
      } finally {
        setChatSwitchPending(false);
      }
    },
    [expandedChatId, mergeChatHistory]
  );

  const handleSelectChatQuery = useCallback(
    async (_chatId: number, messageId: number) => {
      setChatSwitchPending(true);
      setChatId(_chatId);
      setExpandedChatId(_chatId);
      setSelectedQueryMessageId(messageId);
      setErrorMessage(null);
      const chronological = await mergeChatHistory(_chatId);
      const userText = chronological.find((m) => m.id === messageId)?.message ?? "";
      try {
        const d = await fetchMessageDetail(messageId);
        setUserBubble(userText);
        const desc = typeof d.description === "string" ? d.description : "";
        const sqlRaw =
          typeof d.sql === "string" ? d.sql : typeof d.message === "string" ? d.message : null;
        setSqlText(sqlRaw);
        setSqlCopyText(sqlRaw);
        setSummaryText(desc);
        setHasSql(true);
        const payload = Array.isArray(d.payload) ? d.payload : [];
        setRows(payload as Record<string, unknown>[]);
        setWsChart(null);
        setHasData(payload.length > 0);
        setPhase("ready");
      } catch (e) {
        logWs("fetchMessageDetail failed", e);
        setErrorMessage("Не удалось загрузить ответ по этому запросу");
        setPhase("idle");
      } finally {
        setChatSwitchPending(false);
      }
    },
    [mergeChatHistory]
  );

  const handleRenameChat = useCallback(
    async (id: number, nextName: string) => {
      const t = nextName.trim();
      if (!t) return;
      try {
        await updateChat(id, { name: t });
        await refreshChats();
        setErrorMessage(null);
      } catch (e) {
        logWs("updateChat failed", e);
        setErrorMessage("Не удалось переименовать чат");
      }
    },
    [refreshChats]
  );

  const handleDeleteChat = useCallback(
    async (id: number) => {
      try {
        await deleteChat(id);
        setChatHistories((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        if (expandedChatId === id) setExpandedChatId(null);
        if (chatId === id) {
          setChatId(null);
          setSelectedQueryMessageId(null);
          clearMainPanel();
        }
        await refreshChats();
        setErrorMessage(null);
      } catch (e) {
        logWs("deleteChat failed", e);
        setErrorMessage("Не удалось удалить чат");
      }
    },
    [chatId, clearMainPanel, expandedChatId, refreshChats]
  );

  const handleCopyChatSql = useCallback(
    async (id: number) => {
      const sql = (sqlCopyText ?? sqlText ?? "").trim();
      if (chatId !== id || !sql) {
        setErrorMessage(
          "Откройте этот чат и запрос с SQL на экране — или нажмите «копировать» у строки подчата слева."
        );
        return;
      }
      try {
        await navigator.clipboard?.writeText(sqlCopyText ?? sqlText ?? "");
        setErrorMessage(null);
      } catch {
        setErrorMessage("Не удалось скопировать в буфер обмена");
      }
    },
    [chatId, sqlCopyText, sqlText]
  );

  const handleCopyLeafSql = useCallback(async (_chatId: number, messageId: number) => {
    try {
      const d = await fetchMessageDetail(messageId);
      const raw =
        typeof d.sql === "string" ? d.sql : typeof d.message === "string" ? d.message : "";
      if (!raw.trim()) {
        setErrorMessage("Для этого запроса нет сохранённого SQL");
        return;
      }
      await navigator.clipboard?.writeText(raw);
      setErrorMessage(null);
    } catch (e) {
      logWs("copy leaf sql failed", e);
      setErrorMessage("Не удалось получить SQL для копирования");
    }
  }, []);

  const handleNewChat = useCallback(async () => {
    setNewChatPending(true);
    setErrorMessage(null);
    try {
      const c = await createChat("Новый чат");
      setChatId(c.id);
      setExpandedChatId(c.id);
      setChatHistories((prev) => ({ ...prev, [c.id]: [] }));
      clearMainPanel();
      await refreshChats();
    } catch (e) {
      logWs("createChat failed", e);
      setErrorMessage("Не удалось создать чат");
    } finally {
      setNewChatPending(false);
    }
  }, [clearMainPanel, refreshChats]);

  return (
    <ChatDashboardView
      phase={phase}
      userBubble={userBubble}
      draft={draft}
      onDraftChange={setDraft}
      onSend={handleSend}
      sendDisabled={sendDisabled}
      phraseIndex={phraseIndex}
      sqlText={sqlText}
      sqlCopyText={sqlCopyText}
      summaryText={summaryText}
      rows={rows}
      columns={columns}
      errorMessage={errorMessage}
      hasSql={hasSql}
      hasData={hasData}
      barPercents={barPercents}
      pieA={pieA}
      pieB={pieB}
      pieAngle={pieAngle}
      forceTableChartSkeleton={rows.length === 0}
      sidebarChats={sidebarChats}
      onNewChat={handleNewChat}
      onSelectChat={handleSelectChat}
      onSelectChatQuery={handleSelectChatQuery}
      selectedQueryMessageId={selectedQueryMessageId}
      newChatPending={newChatPending}
      chatSwitchPending={chatSwitchPending}
      workspaceChatId={chatId}
      workspaceSql={sqlCopyText ?? sqlText}
      onRenameChat={handleRenameChat}
      onDeleteChat={handleDeleteChat}
      onCopyChatSql={handleCopyChatSql}
      onCopyLeafSql={handleCopyLeafSql}
    />
  );
}
