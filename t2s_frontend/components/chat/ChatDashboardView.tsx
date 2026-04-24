"use client";

import Image from "next/image";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  Database,
  Menu,
  Pencil,
  Plus,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { QueryInputBar } from "@/components/QueryInputBar";
import { MessageSquare } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useEffect, useRef, useState } from "react";
import {
  MAILING_COMMENT_MAX_LENGTH,
  type CreateMailingPayload,
  type ExportFormat,
  type MailingRepeat,
} from "@/lib/api";
import type { BarDatum } from "@/components/chat/chartFromRows";
export type DashboardPhase = "idle" | "loading" | "ready";

export type SidebarQueryLeaf = { id: number; text: string };

export type SidebarChatItem = {
  id: number;
  title: string;
  active?: boolean;
  expanded?: boolean;
  queries: SidebarQueryLeaf[];
};

export type ChatDashboardViewProps = {
  phase: DashboardPhase;
  userBubble: string;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  sendDisabled: boolean;
  phraseIndex: number;
  sqlText: string | null;
  sqlCopyText?: string | null;
  summaryText: string;
  rows: Record<string, unknown>[];
  columns: string[];
  errorMessage: string | null;
  hasSql: boolean;
  hasData: boolean;
  chartBars: BarDatum[];
  forceTableChartSkeleton?: boolean;
  sidebarChats?: SidebarChatItem[];
  onNewChat?: () => void;
  onSelectChat?: (chatId: number) => void;
  onSelectChatQuery?: (chatId: number, messageId: number) => void;
  selectedQueryMessageId?: number | null;
  newChatPending?: boolean;
  chatSwitchPending?: boolean;
  workspaceChatId?: number | null;
  workspaceSql?: string | null;
  onRenameChat?: (chatId: number, nextName: string) => void;
  onDeleteChat?: (chatId: number) => void;
  onCopyChatSql?: (chatId: number) => void;
  onCopyLeafSql?: (chatId: number, messageId: number) => void;
  canDownload?: boolean;
  onDownloadFormat?: (fmt: ExportFormat) => void | Promise<void>;
  mailingMessageId?: number | null;
  onCreateMailing?: (payload: CreateMailingPayload) => void | Promise<void>;
  onOpenDatabasePicker?: () => void;
  /** Скрыть баннер ошибки в шапке (моб. «как Issue»). */
  onDismissError?: () => void;
};

const sqlTheme = {
  ...oneLight,
  'pre[class*="language-"]': {
    ...oneLight['pre[class*="language-"]'],
    margin: 0,
    padding: 0,
    background: "transparent",
    fontSize: "11px",
    lineHeight: "1.7",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  },
  'code[class*="language-"]': {
    ...oneLight['code[class*="language-"]'],
    background: "transparent",
    color: "#6a7080",
  },
  keyword: {
    color: "#0f766e",
    fontWeight: 500,
  },
  string: {
    color: "#0f766e",
  },
  number: {
    color: "#7c3aed",
  },
  punctuation: {
    color: "#8d8d93",
  },
  operator: {
    color: "#8d8d93",
  },
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  return String(value);
}

function sentenceCaseRu(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function ChatDashboardView({
  phase,
  userBubble,
  draft,
  onDraftChange,
  onSend,
  sendDisabled,
  phraseIndex,
  sqlText,
  sqlCopyText = null,
  summaryText,
  rows,
  columns,
  errorMessage,
  hasSql,
  hasData,
  chartBars,
  forceTableChartSkeleton = false,
  sidebarChats = [],
  onNewChat,
  onSelectChat,
  onSelectChatQuery,
  selectedQueryMessageId = null,
  newChatPending = false,
  chatSwitchPending = false,
  workspaceChatId = null,
  workspaceSql = null,
  onRenameChat,
  onDeleteChat,
  onCopyChatSql,
  onCopyLeafSql,
  canDownload = false,
  onDownloadFormat,
  mailingMessageId = null,
  onCreateMailing,
  onOpenDatabasePicker,
  onDismissError,
}: ChatDashboardViewProps) {
  const showBubble =
    userBubble.length > 0 &&
    !chatSwitchPending &&
    (phase === "loading" || phase === "ready");
  const copySource = sqlCopyText ?? sqlText ?? "";
  const [feedbackToast, setFeedbackToast] = useState<{
    message: string;
    anchor: "sql" | "table" | "chart";
  } | null>(null);
  const [mailingModalOpen, setMailingModalOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chats" | "extras">("chats");
  const [tableFilter, setTableFilter] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const toastTimerRef = useRef<number | null>(null);

  const normalizedFilter = tableFilter.trim().toLowerCase();
  const filteredRows = normalizedFilter
    ? rows.filter((row) =>
        columns.some((col) => {
          const value = row[col];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(normalizedFilter);
        }),
      )
    : rows;

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    const aNum = typeof aVal === "number" ? aVal : Number(aVal);
    const bNum = typeof bVal === "number" ? bVal : Number(bVal);
    const bothNumeric = Number.isFinite(aNum) && Number.isFinite(bNum);

    let comparison = 0;
    if (bothNumeric) {
      comparison = aNum - bNum;
    } else {
      comparison = String(aVal).localeCompare(String(bVal), "ru", {
        numeric: true,
        sensitivity: "base",
      });
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const showFeedbackToast = (message: string, anchor: "sql" | "table" | "chart") => {
    setFeedbackToast({ message, anchor });
    if (toastTimerRef.current != null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setFeedbackToast(null);
      toastTimerRef.current = null;
    }, 1800);
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard?.writeText(copySource);
      showFeedbackToast("Скопировано", "sql");
    } catch {
      showFeedbackToast("Не удалось скопировать", "sql");
    }
  };

  const buildShareUrl = (): string => {
    if (typeof window === "undefined") return "";
    const url = new URL(`${window.location.origin}${window.location.pathname}`);
    if (workspaceChatId != null) url.searchParams.set("chat", String(workspaceChatId));
    if (selectedQueryMessageId != null) url.searchParams.set("message", String(selectedQueryMessageId));
    return url.toString();
  };

  /** Web Share API или копирование текста со ссылкой в буфер. */
  const handleShareSection = async (kind: "table" | "chart") => {
    const label = kind === "table" ? "Таблица результатов" : "График";
    const url = buildShareUrl() || (typeof window !== "undefined" ? window.location.href : "");
    const parts: string[] = [`T2S — ${label}`];
    if (userBubble.trim()) parts.push(`Вопрос: ${userBubble.trim()}`);
    if (summaryText.trim()) parts.push(summaryText.trim().slice(0, 800));
    parts.push(`Открыть: ${url}`);
    const text = parts.join("\n\n");

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: `T2S: ${label}`, text, url });
          showFeedbackToast("Готово", kind);
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
        }
      }
      await navigator.clipboard?.writeText(text);
      showFeedbackToast("Скопировано", kind);
    } catch {
      showFeedbackToast("Не удалось поделиться", kind);
    }
  };

  const closeMobile = () => setMobileOpen(false);

  const chatsInner = (
    <>
      <div className="mb-4 hidden lg:block">
        <p className="font-heading text-[20px] font-bold leading-none text-[#2d2e33]">Чаты</p>
        <p className="mt-1 text-[12px] leading-snug text-[#8d8d93]">Все чаты и запросы в них</p>
      </div>

      <button
        type="button"
        disabled={newChatPending}
        className="mb-4 inline-flex w-full max-w-[180px] items-center justify-center gap-2 rounded-[7px] bg-[#0b7a73] px-4 py-2 text-[14px] font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#09665f] hover:shadow-sm disabled:pointer-events-none disabled:opacity-60"
        onClick={() => {
          onNewChat?.();
          closeMobile();
        }}
      >
        <Plus className="h-4 w-4" strokeWidth={2.2} />
        Новый чат
      </button>

      <nav className="min-h-0 max-h-[36dvh] flex-1 space-y-2 overflow-y-auto pr-1 lg:max-h-none">
        {sidebarChats.length === 0 ? (
          <p className="pl-1 text-[13px] leading-6 text-[#8d8d93]">История появится после диалога с сервисом.</p>
        ) : (
          sidebarChats.map((c) => (
            <ChatGroup
              key={c.id}
              chatId={c.id}
              title={c.title}
              active={c.active}
              expanded={c.expanded}
              queries={c.queries}
              selectedQueryMessageId={selectedQueryMessageId}
              workspaceChatId={workspaceChatId}
              workspaceSql={workspaceSql}
              onSelectRoot={() => onSelectChat?.(c.id)}
              onSelectLeaf={(messageId) => {
                onSelectChatQuery?.(c.id, messageId);
                closeMobile();
              }}
              onRename={(nextName) => onRenameChat?.(c.id, nextName)}
              onDelete={() => onDeleteChat?.(c.id)}
              onCopyChatSql={() => onCopyChatSql?.(c.id)}
              onCopyLeafSql={(messageId) => onCopyLeafSql?.(c.id, messageId)}
            />
          ))
        )}
      </nav>

      <div className="mt-4 rounded-[16px] border border-[#e0dde4] bg-white px-4 py-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm">
        <p className="font-heading text-[18px] font-bold leading-none text-[#0b7a73]">Базы данных</p>
        <button
          type="button"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[#c0eeea] py-3 text-[14px] font-semibold text-[#0b7a73] transition-colors hover:bg-[#b4e8e3]"
          onClick={() => {
            onOpenDatabasePicker?.();
            closeMobile();
          }}
        >
          <Database className="h-4 w-4" strokeWidth={1.8} />
          Выбрать базу данных
        </button>
      </div>
    </>
  );

  const extrasInner = (
    <>
      <h2 className="hidden font-heading text-[20px] font-bold text-[#2d2e33] lg:block">Дополнительная информация</h2>

      <p className="mt-2 font-sans text-[11px] tracking-normal text-[#8d8d93]">Код SQL</p>

      <div className="relative min-h-[160px] overflow-hidden rounded-[10px] bg-[#e8e4ea] p-4 lg:min-h-[196px]">
        {sqlText ? (
          <>
            <div className="max-h-[min(42vh,320px)] min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-12 pb-12 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:max-h-[min(48vh,400px)]">
              <SyntaxHighlighter
                language="sql"
                style={sqlTheme}
                wrapLongLines
                customStyle={{
                  margin: 0,
                  padding: 0,
                  background: "transparent",
                  overflow: "visible",
                }}
                codeTagProps={{
                  style: {
                    fontSize: "11px",
                    lineHeight: "1.7",
                  },
                }}
              >
                {sqlText}
              </SyntaxHighlighter>
            </div>

            <div className="absolute bottom-3 right-3">
              {feedbackToast?.anchor === "sql" && (
                <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 whitespace-nowrap rounded-md bg-[#0b7a73] px-2.5 py-1 font-sans text-[12px] font-medium text-white shadow-sm">
                  {feedbackToast.message}
                </div>
              )}
              <button
                type="button"
                className="rounded-[10px] bg-[#d0ccc9] p-2 text-[#7a7d84]"
                aria-label="Копировать SQL"
                onClick={() => void handleCopySql()}
              >
                <Copy className="h-4 w-4" strokeWidth={1.8} />
              </button>
            </div>
          </>
        ) : phase === "loading" || chatSwitchPending || newChatPending ? (
          <SqlCodeSkeleton />
        ) : (
          <p className="t2s-enter pt-2 text-[13px] leading-6 text-[#8d8d93]">Здесь появится сгенерированный SQL.</p>
        )}
      </div>

      <div className="rounded-[16px] border border-[#e0dde4] bg-white px-4 py-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm">
        <p className="font-heading text-[18px] font-bold leading-none text-[#0b7a73]">Скачивание</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canDownload}
            className="rounded-full bg-[#e1f6f3] px-4 py-2 text-[13px] font-semibold text-[#0b7a73] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void onDownloadFormat?.("xlsx")}
          >
            Скачать Excel
          </button>
          <button
            type="button"
            disabled={!canDownload}
            className="rounded-full bg-[#e1f6f3] px-4 py-2 text-[13px] font-semibold text-[#0b7a73] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void onDownloadFormat?.("pdf")}
          >
            Скачать PDF
          </button>
          <button
            type="button"
            disabled={!canDownload}
            className="rounded-full bg-[#e1f6f3] px-4 py-2 text-[13px] font-semibold text-[#0b7a73] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => void onDownloadFormat?.("docx")}
          >
            Скачать DOCX
          </button>
        </div>
      </div>

      <div className="rounded-[16px] border border-[#e0dde4] bg-white px-4 py-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm">
        <p className="font-heading text-[18px] font-bold leading-none text-[#0b7a73]">Рассылка</p>
        <button
          type="button"
          disabled={mailingMessageId == null}
          className="mt-5 w-full rounded-[12px] bg-[#c0eeea] py-3 text-[14px] font-semibold text-[#0b7a73] transition-colors hover:bg-[#b4e8e3] disabled:cursor-not-allowed disabled:opacity-55"
          onClick={() => {
            setMailingModalOpen(true);
            closeMobile();
          }}
        >
          Отправить ссылку
        </button>
      </div>
    </>
  );

  return (
    <>
      <header className="flex h-[72px] items-center gap-2 border-b border-[#e8e4ee] bg-gradient-to-b from-white to-[#f3f0f6] px-3 sm:gap-3 sm:px-5 lg:h-[10dvh] lg:border-transparent lg:bg-gradient-to-b lg:from-transparent lg:to-transparent">
        <button
          type="button"
          className="shrink-0 rounded-xl p-2 text-[#0b7a73] transition-colors hover:bg-[#0b7a73]/10 lg:hidden"
          aria-expanded={mobileOpen}
          aria-label="Открыть меню"
          onClick={() => {
            if (mobileOpen) {
              setMobileOpen(false);
            } else {
              setMobileTab("chats");
              setMobileOpen(true);
            }
          }}
        >
          <Menu className="h-7 w-7" strokeWidth={2} />
        </button>
        <Image
          src="/t2slogo.svg"
          alt="T2S"
          width={96}
          height={44}
          priority
          className="h-9 w-auto shrink-0 sm:h-10 lg:h-11"
        />
        <div className="min-w-0 flex-1 lg:flex-none" aria-hidden="true" />
        {errorMessage != null && errorMessage.trim() !== "" && (
          <div
            className="flex max-w-[min(220px,52vw)] shrink-0 items-center gap-1 rounded-full bg-[#e53935] py-0.5 pl-1 pr-0.5 text-white shadow-sm ring-1 ring-black/5 sm:max-w-[260px] sm:gap-1.5 sm:pl-1.5 sm:pr-1"
            title={errorMessage}
          >
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/15 text-[12px] font-bold leading-none"
              aria-hidden
            >
              !
            </span>
            <span className="min-w-0 flex-1 truncate text-left text-[11px] font-semibold leading-tight sm:text-xs">
              Ошибка
            </span>
            {onDismissError != null ? (
              <button
                type="button"
                className="shrink-0 rounded-full p-1.5 text-white/95 transition-colors hover:bg-black/15"
                aria-label="Скрыть уведомление"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismissError();
                }}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            ) : null}
          </div>
        )}
      </header>

      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-x-0 bottom-0 top-[calc(72px+10px)] z-[115] backdrop-blur-[1px] lg:hidden"
          aria-label="Закрыть панель"
          onClick={closeMobile}
        />
      )}

      {mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 left-0 top-[calc(72px+10px)] z-[125] flex flex-col overflow-hidden rounded-t-[16px] border border-[#e2dfe6]/80 bg-[#fbfafc] shadow-[0_-8px_28px_rgba(15,23,42,0.1)] lg:hidden">
          <div className="flex shrink-0 items-center gap-2 border-b border-[#e4e0ea] bg-[#F5F3F8] px-3 py-2.5">
            <div className="relative flex min-w-0 flex-1 rounded-[10px] bg-[#e4e0ea]/70 p-0.5">
              <span
                className="absolute bottom-0.5 top-0.5 w-[calc(50%-6px)] rounded-[8px] bg-white shadow-sm transition-[left] duration-300 ease-out motion-reduce:transition-none"
                style={{
                  left: mobileTab === "chats" ? "4px" : "calc(50% + 1px)",
                }}
                aria-hidden
              />
              <button
                type="button"
                className={`relative z-[1] min-w-0 flex-1 rounded-[8px] py-2 text-center font-heading text-[14px] font-semibold transition-colors duration-300 ease-out ${
                  mobileTab === "chats" ? "text-[#0b7a73]" : "text-[#5f6168]"
                }`}
                onClick={() => setMobileTab("chats")}
              >
                Чаты
              </button>
              <button
                type="button"
                className={`relative z-[1] min-w-0 flex-1 rounded-[8px] py-2 text-center font-heading text-[14px] font-semibold transition-colors duration-300 ease-out ${
                  mobileTab === "extras" ? "text-[#0b7a73]" : "text-[#5f6168]"
                }`}
                onClick={() => setMobileTab("extras")}
              >
                Дополнительно
              </button>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg p-2 text-[#5f6168] transition-colors hover:bg-black/[0.06]"
              aria-label="Закрыть"
              onClick={closeMobile}
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <div
              className={`absolute inset-0 overflow-y-auto bg-[#F5F3F8] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-sm sm:p-5 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                mobileTab === "chats" ? "z-[2] opacity-100" : "pointer-events-none z-0 opacity-0"
              }`}
            >
              {chatsInner}
            </div>
            <div
              className={`absolute inset-0 flex min-h-0 flex-col gap-5 overflow-y-auto bg-[#F5F3F8] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-sm sm:gap-6 sm:p-5 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
                mobileTab === "extras" ? "z-[2] opacity-100" : "pointer-events-none z-0 opacity-0"
              }`}
            >
              {extrasInner}
            </div>
          </div>
        </div>
      )}

    <div className="flex min-h-0 w-full flex-col text-[#26262b] lg:h-[90dvh] lg:flex-row">
      <aside className="order-1 hidden min-h-0 w-full shrink-0 flex-col lg:flex lg:order-none lg:w-[240px] xl:w-1/5">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-b-[28px] bg-[#F5F3F8] p-4 shadow-sm sm:p-5 lg:rounded-b-none lg:rounded-tr-[50px] lg:p-6">
          {chatsInner}
        </div>
      </aside>

      <section className="order-2 relative flex min-w-0 flex-1 flex-col bg-[#fbfafc] px-3 pt-4 sm:px-5 sm:pt-6 lg:order-none lg:px-4 xl:px-5">
        <div className="flex-1 overflow-y-auto pb-8 lg:pb-36">
          <div
            className="mx-auto max-w-[860px] min-h-[min(520px,72dvh)]"
            aria-busy={phase === "loading" || chatSwitchPending || newChatPending}
          >
            {phase === "idle" && !chatSwitchPending && (
              <div className="t2s-enter mx-auto mt-24 flex h-[260px] max-w-[760px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#d8d5dd] bg-white/80 px-8 text-center shadow-sm">
                <Sparkles className="mb-3 h-8 w-8 text-[#0b7a73]/70" strokeWidth={1.6} />
                <p className="text-[15px] leading-7 text-[#8f8f96]">
                  Задайте вопрос в поле ниже — здесь появятся ответ, таблица и график.
                </p>
              </div>
            )}

            {phase === "loading" && (
              <div className="t2s-enter mx-auto flex max-w-[760px] flex-col gap-5">
                {showBubble && (
                  <div className="t2s-enter ml-auto max-w-[90%] rounded-[10px] bg-[#b9efe7] px-5 py-3 text-[14px] leading-6 text-[#283136] shadow-sm motion-safe:animate-pulse">
                    {userBubble}
                  </div>
                )}
                <LoadingAnswerBlock phraseIndex={phraseIndex} hasSql={hasSql} hasData={hasData} />
                <PanelSkeleton title="Таблица" />
                <PanelSkeleton title="График" tall />
                {errorMessage && (
                  <p className="rounded-2xl border border-[#f0c4c4] bg-[#fff5f5] px-5 py-4 text-[14px] text-[#8a2c2c]">
                    {errorMessage}
                  </p>
                )}
              </div>
            )}

            {chatSwitchPending && phase !== "loading" && (
              <div className="t2s-enter mx-auto flex max-w-[760px] flex-col gap-5">
                <article className="rounded-[10px] border border-[#e5e2e8] bg-white px-4 py-4 shadow-sm sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-sans text-[12px] font-bold tracking-normal text-[#0b7a73]">Загрузка чата</h2>
                    <Sparkles className="h-6 w-6 shrink-0 animate-pulse text-[#0b7a73]" strokeWidth={1.5} />
                  </div>
                  <div className="mt-8 flex flex-col items-center gap-5 py-4">
                    <div className="h-10 w-10 rounded-full border-2 border-[#d9d5dd] border-t-[#0b7a73] motion-safe:animate-spin" />
                    <p className="t2s-phrase-in text-center text-[15px] leading-7 text-[#4b4d55]">
                      Подгружаю данные выбранного чата…
                    </p>
                  </div>
                </article>
                <PanelSkeleton title="Таблица" />
                <PanelSkeleton title="График" tall />
              </div>
            )}

            {phase === "ready" && !chatSwitchPending && (
              <div className="t2s-enter mx-auto flex max-w-[760px] flex-col gap-5">
                {showBubble && (
                  <div className="t2s-enter ml-auto max-w-[90%] rounded-[10px] bg-[#b9efe7] px-5 py-3 text-[14px] leading-6 text-[#283136] shadow-sm transition-transform duration-200 ease-out hover:-translate-y-0.5">
                    {userBubble}
                  </div>
                )}

                <article className="rounded-[10px] border border-[#e5e2e8] bg-white px-4 py-4 shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm sm:px-5">
                  <h2 className="font-sans text-[12px] font-bold tracking-normal text-[#0b7a73]">Ответ</h2>
                  <p className="mt-1 text-[12px] leading-snug text-[#8d8d93]">
                    Что делает запрос и какой это отчёт для пользователя
                  </p>
                  <p className="mt-4 line-clamp-4 max-h-[7.5rem] whitespace-pre-line text-[15px] leading-7 text-[#4b4d55] [overflow-wrap:anywhere]">
                    {summaryText || "—"}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <DonePill label="Создан SQL" />
                    <DonePill label="Таблица готова" />
                    <DonePill label="График готов" />
                  </div>
                </article>

                {forceTableChartSkeleton ? (
                  <>
                    <PanelSkeleton title="Таблица" />
                    <PanelSkeleton title="График" tall />
                  </>
                ) : (
                  <>
                    <article className="overflow-visible rounded-[10px] border border-[#e5e2e8] bg-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm">
                      <header className="relative z-10 flex items-center justify-between overflow-visible bg-[#f8f6fa] px-4 py-4 sm:px-5">
                        <h3 className="font-heading text-[13px] font-bold text-[#2f3138]">Таблица</h3>
                        <div className="relative shrink-0">
                          {feedbackToast?.anchor === "table" && (
                            <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 whitespace-nowrap rounded-md bg-[#0b7a73] px-2.5 py-1 font-sans text-[12px] font-medium text-white shadow-sm">
                              {feedbackToast.message}
                            </div>
                          )}
                          <button
                            type="button"
                            className="rounded-full p-1.5 text-[#666873] hover:bg-black/5"
                            aria-label="Поделиться таблицей"
                            onClick={() => void handleShareSection("table")}
                          >
                            <Share2 className="h-4.5 w-4.5" strokeWidth={1.6} />
                          </button>
                        </div>
                      </header>

                      <div className="overflow-hidden rounded-b-[10px]">
                        <div className="px-3 pb-3 pt-3 sm:px-4">
                          <label className="flex items-center gap-2 rounded-[12px] border border-[#e7e3ea] bg-[#faf9fb] px-3 py-2 text-[#8b8d94] focus-within:border-[#b9efe7] focus-within:text-[#0b7a73]">
                            <Search className="h-4 w-4 shrink-0" strokeWidth={1.9} />
                            <input
                              type="text"
                              value={tableFilter}
                              onChange={(e) => setTableFilter(e.target.value)}
                              placeholder="Фильтр по таблице"
                              className="w-full bg-transparent text-[13px] text-[#3c3f46] placeholder:text-[#a7a9b0] focus:outline-none"
                            />
                          </label>
                        </div>

                        <div className="overflow-x-auto px-2 pb-4 pt-1">
                        {columns.length === 0 ? (
                          <p className="px-4 py-8 text-center text-[14px] text-[#8C8C8C]">Нет данных для отображения.</p>
                        ) : sortedRows.length === 0 ? (
                          <p className="px-4 py-8 text-center text-[14px] text-[#8C8C8C]">По фильтру ничего не найдено.</p>
                        ) : (
                          <table
                            className="w-full border-separate border-spacing-0 text-left text-[13px]"
                            style={{ minWidth: `${Math.max(520, columns.length * 170)}px` }}
                          >
                            <thead>
                              <tr className="text-[#8b8d94]">
                                {columns.map((col, i) => (
                                  <th
                                    key={col}
                                    className={`bg-[#faf9fb] px-4 py-3 font-medium ${
                                      i === 0 ? "rounded-l-xl" : ""
                                    } ${i === columns.length - 1 ? "rounded-r-xl" : ""} min-w-[150px]`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (sortColumn !== col) {
                                          setSortColumn(col);
                                          setSortDirection("asc");
                                          return;
                                        }
                                        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                                      }}
                                      className="group inline-flex items-center gap-1.5 whitespace-nowrap text-left text-[#6f727b] transition-colors hover:text-[#0b7a73]"
                                      aria-label={`Сортировать по столбцу ${col}`}
                                    >
                                      <span>{col}</span>
                                      {sortColumn === col ? (
                                        sortDirection === "asc" ? (
                                          <ArrowUp className="h-4 w-4 shrink-0 text-[#0b7a73]" strokeWidth={1.9} />
                                        ) : (
                                          <ArrowDown className="h-4 w-4 shrink-0 text-[#0b7a73]" strokeWidth={1.9} />
                                        )
                                      ) : (
                                        <ArrowUpDown
                                          className="h-4 w-4 shrink-0 text-[#a3a5ad] transition-colors group-hover:text-[#0b7a73]"
                                          strokeWidth={1.9}
                                        />
                                      )}
                                    </button>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sortedRows.map((row, ri) => (
                                <tr key={ri} className="border-b border-[#f1eef4] last:border-0">
                                  {columns.map((col) => (
                                    <td key={col} className="px-4 py-3 text-[#3c3f46]">
                                      {formatCell(row[col])}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                        </div>
                      </div>
                    </article>

                    <article className="overflow-visible rounded-[10px] border border-[#e5e2e8] bg-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm">
                      <header className="relative z-10 flex items-center justify-between overflow-visible bg-[#f8f6fa] px-4 py-4 sm:px-5">
                        <h3 className="font-heading text-[13px] font-bold text-[#2f3138]">График</h3>
                        <div className="relative shrink-0">
                          {feedbackToast?.anchor === "chart" && (
                            <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 whitespace-nowrap rounded-md bg-[#0b7a73] px-2.5 py-1 font-sans text-[12px] font-medium text-white shadow-sm">
                              {feedbackToast.message}
                            </div>
                          )}
                          <button
                            type="button"
                            className="rounded-full p-1.5 text-[#666873] hover:bg-black/5"
                            aria-label="Поделиться графиком"
                            onClick={() => void handleShareSection("chart")}
                          >
                            <Share2 className="h-4.5 w-4.5" strokeWidth={1.6} />
                          </button>
                        </div>
                      </header>

                      <div className="overflow-hidden rounded-b-[10px] px-4 py-6 sm:px-5">
                        {chartBars.length === 0 ? (
                          <p className="py-8 text-center text-[14px] text-[#8C8C8C]">Нет данных для построения графика.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-[12px] px-4 py-4">
                            {(() => {
                              const maxAbs = Math.max(1, ...chartBars.map((x) => Math.abs(x.value)));
                              const minAbs = Math.min(...chartBars.map((x) => Math.abs(x.value)));
                              const span = Math.max(1, maxAbs - minAbs);
                              return (
                            <div
                              className="flex h-[236px] items-end gap-5"
                              style={{ minWidth: `${Math.max(520, chartBars.length * 96)}px` }}
                            >
                              {chartBars.map((item, i) => {
                                const absVal = Math.abs(item.value);
                                const normalized = (absVal - minAbs) / span;
                                const shapeHeight = Math.round(72 + normalized * 136);
                                const isDot = normalized < 0.15;
                                return (
                                  <div key={`${item.label}-${i}`} className="flex w-[76px] shrink-0 flex-col items-center justify-end">
                                    <span className="mb-2 font-sans text-[11px] font-medium tabular-nums text-[#4e525c]">
                                      {Number.isInteger(item.value) ? item.value : item.value.toFixed(2)}
                                    </span>
                                    <div
                                      className="transition-all duration-500 ease-out"
                                      style={
                                        isDot
                                          ? {
                                              width: "50px",
                                              height: "70px",
                                              borderRadius: "9999px",
                                              border: "2px solid #0b9d97",
                                              background: "#F5F3F8",
                                            }
                                          : {
                                              width: "50px",
                                              height: `${shapeHeight}px`,
                                              borderRadius: "40px",
                                              border: "2px solid #0b9d97",
                                              background: "#F5F3F8",
                                            }
                                      }
                                    />
                                    <span
                                      className="mt-2 block w-full truncate px-1 text-center font-sans text-[11px] leading-tight text-[#5a5d66]"
                                      title={item.label}
                                    >
                                      {item.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </article>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-none sticky inset-x-0 bottom-0 mt-4 bg-gradient-to-t from-[#fbfafc] via-[#fbfafc] to-transparent pb-3 pt-6 lg:absolute lg:mt-0 lg:pb-4 lg:pt-10">
          <div className="pointer-events-auto mx-auto max-w-[760px] px-1 sm:px-3 lg:px-5">
            <QueryInputBar
              className="w-full"
              value={draft}
              onChange={onDraftChange}
              onSubmit={onSend}
              disabled={sendDisabled}
            />
          </div>
        </div>
      </section>

      <aside className="order-3 hidden min-h-0 w-full shrink-0 flex-col lg:flex lg:order-none lg:w-[240px] xl:w-1/5">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto rounded-t-[28px] bg-[#F5F3F8] p-4 shadow-sm sm:gap-6 sm:p-5 lg:rounded-t-none lg:rounded-tl-[50px] lg:p-6">
          {extrasInner}
        </div>
      </aside>
    </div>
    {mailingModalOpen && (
      <MailingModal
        onClose={() => setMailingModalOpen(false)}
        onSubmit={onCreateMailing}
        messageId={mailingMessageId}
      />
    )}
    </>
  );
}

function formatDateTimeInputLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function toIsoFromLocalInput(localValue: string): string {
  const dt = new Date(localValue);
  return dt.toISOString();
}

function addEmails(raw: string, current: string[]): string[] {
  const out = [...current];
  const seen = new Set(out.map((x) => x.toLowerCase()));
  const parts = raw
    .split(/[,\s;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  for (const item of parts) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

function repeatLabel(value: MailingRepeat): string {
  if (value === "day") return "Каждый день";
  if (value === "week") return "Каждую неделю";
  if (value === "month") return "Каждый месяц";
  return "Разово";
}

function toMondayIndex(day: number): number {
  return (day + 6) % 7;
}

function sameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function MailingModal({
  onClose,
  onSubmit,
  messageId,
}: {
  onClose: () => void;
  onSubmit?: (payload: CreateMailingPayload) => void | Promise<void>;
  messageId: number | null;
}) {
  const [emailInput, setEmailInput] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return formatDateTimeInputLocal(d);
  });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [repeat, setRepeat] = useState<MailingRepeat>("none");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const d = new Date(scheduledAt);
    if (Number.isNaN(d.getTime())) return;
    setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
  }, [scheduledAt]);

  const commitEmails = () => {
    if (!emailInput.trim()) return;
    setEmails((prev) => addEmails(emailInput, prev));
    setEmailInput("");
  };

  const submit = async () => {
    setFormError(null);
    setSuccessText(null);

    if (messageId == null) {
      setFormError("Не найден message_id для рассылки.");
      return;
    }

    const finalEmails = emailInput.trim() ? addEmails(emailInput, emails) : emails;
    if (finalEmails.length === 0) {
      setFormError("Добавьте хотя бы один email.");
      return;
    }

    if (!scheduledAt) {
      setFormError("Укажите дату и время отправки.");
      return;
    }

    const payload: CreateMailingPayload = {
      message_id: messageId,
      scheduled_at: toIsoFromLocalInput(scheduledAt),
      repeat,
      emails: finalEmails,
      comment: comment.trim(),
    };

    setSubmitting(true);
    try {
      await onSubmit?.(payload);
      setSuccessText(`Рассылка создана: ${repeatLabel(repeat)}.`);
      setEmails([]);
      setEmailInput("");
      setComment("");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Не удалось создать рассылку.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDateTime = (() => {
    const d = new Date(scheduledAt);
    if (Number.isNaN(d.getTime())) return new Date();
    return d;
  })();

  const monthTitle = sentenceCaseRu(
    new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(calendarMonth)
  );

  const currentMonthYear = new Intl.DateTimeFormat("ru-RU", {
    year: "numeric",
  }).format(calendarMonth);

  const firstDayOffset = toMondayIndex(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay());
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const daysInPrevMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 0).getDate();
  const calendarCells = Array.from({ length: 42 }).map((_, i) => {
    if (i < firstDayOffset) {
      const day = daysInPrevMonth - firstDayOffset + i + 1;
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, day);
      return { date, inCurrentMonth: false };
    }
    if (i < firstDayOffset + daysInMonth) {
      const day = i - firstDayOffset + 1;
      const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      return { date, inCurrentMonth: true };
    }
    const day = i - (firstDayOffset + daysInMonth) + 1;
    const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, day);
    return { date, inCurrentMonth: false };
  });

  const selectCalendarDate = (picked: Date) => {
    const next = new Date(selectedDateTime);
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    setScheduledAt(formatDateTimeInputLocal(next));
  };

  const selectedDateLine = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selectedDateTime);

  const timeValue = `${pad2(selectedDateTime.getHours())}:${pad2(selectedDateTime.getMinutes())}`;

  const onTimeInputChange = (value: string) => {
    if (!value) return;
    const [hh, mm] = value.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return;
    const d = new Date(selectedDateTime);
    d.setHours(hh, mm, 0, 0);
    setScheduledAt(formatDateTimeInputLocal(d));
  };

  const dayLetters = ["п", "в", "с", "ч", "п", "с", "в"];

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto overflow-x-hidden bg-black/25 px-2 py-4 backdrop-blur-[2px] sm:px-4 sm:py-6">
      <div className="flex min-h-[100svh] w-full items-start justify-center sm:items-center sm:py-2">
        <section className="relative my-auto w-full max-w-[780px] max-h-none rounded-[16px] border border-[#0E847D] bg-[#FBFBFB] px-2.5 py-3 font-sans text-[#0A7772] shadow-sm sm:max-h-[min(90dvh,800px)] sm:overflow-y-auto sm:rounded-[20px] sm:px-4 sm:py-4 lg:px-5 lg:py-5">
        <div className="mb-1.5 flex justify-end sm:mb-2">
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c8d5d4] bg-white text-[#6a8a87] transition hover:border-[#17C7BE] hover:text-[#0A7772]"
            aria-label="Закрыть окно рассылки"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-[min(100%,560px)] flex-col gap-3 sm:max-w-[620px] sm:gap-4">
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,280px)_1fr] lg:items-start lg:gap-6">
            <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:items-center sm:gap-3.5 lg:items-stretch">
              <section className="w-full rounded-[10px] border border-[#c8d5d4] bg-[#F7F7FB] px-2.5 pb-4 pt-2.5 shadow-sm sm:px-4 sm:pb-5 sm:pt-3 lg:max-w-none">
                <header className="mb-1.5 flex items-center justify-center gap-0.5 sm:mb-2 sm:gap-2">
                  <button
                    type="button"
                    aria-label="Предыдущий месяц"
                    className="flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center text-[#1AC8BE] sm:h-7 sm:w-7"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                      )
                    }
                  >
                    <span className="text-[22px] font-light leading-none sm:text-[28px]">‹</span>
                  </button>
                  <h2 className="min-w-0 flex-1 px-0.5 text-center font-heading text-[18px] font-normal leading-tight tracking-[0.02em] text-[#0A7772] sm:text-[22px] sm:leading-none lg:text-[26px]">
                    {monthTitle}
                  </h2>
                  <button
                    type="button"
                    aria-label="Следующий месяц"
                    className="flex h-8 w-8 shrink-0 touch-manipulation items-center justify-center text-[#1AC8BE] sm:h-7 sm:w-7"
                    onClick={() =>
                      setCalendarMonth(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                      )
                    }
                  >
                    <span className="text-[22px] font-light leading-none sm:text-[28px]">›</span>
                  </button>
                </header>
                <p className="mb-1.5 text-center font-sans text-[10px] text-[#0A948D]/90 sm:mb-2 sm:text-[11px]">
                  {currentMonthYear}
                </p>
                <div className="mx-auto mb-1.5 h-px w-[88%] bg-[#0FB7B0] sm:mb-2" />

                <div className="grid grid-cols-7 gap-x-0 gap-y-1 px-0 pb-0 pt-0 text-center sm:gap-x-1.5 sm:gap-y-2 sm:px-0.5 sm:pb-0.5 sm:pt-0.5">
                  {dayLetters.map((day, index) => (
                    <div
                      key={`${day}-${index}`}
                      className="py-0 font-sans text-[10px] font-normal lowercase leading-[1.2] text-[#0A7772] sm:py-0.5 sm:text-[12px]"
                    >
                      {day}
                    </div>
                  ))}
                  {calendarCells.map((cell, index) => (
                    <button
                      key={`${cell.date.toISOString()}-${index}`}
                      type="button"
                      onClick={() => selectCalendarDate(cell.date)}
                      className={`min-h-[1.75rem] rounded-[5px] py-1 text-[15px] font-light leading-none outline-none transition focus-visible:ring-2 focus-visible:ring-[#17C7BE]/40 sm:min-h-[2.125rem] sm:py-1.5 sm:text-[18px] lg:text-[20px] ${
                        sameDate(cell.date, selectedDateTime)
                          ? "font-semibold text-[#0A7772] underline decoration-[#0FB7B0] decoration-2 underline-offset-4 sm:underline-offset-[5px]"
                          : cell.inCurrentMonth
                          ? "text-[#0A948D] hover:bg-white/50"
                          : "text-[#0A948D]/45 hover:bg-white/40 hover:text-[#0A948D]/70"
                      }`}
                      aria-label={new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(cell.date)}
                    >
                      {cell.date.getDate()}
                    </button>
                  ))}
                </div>
              </section>

              <div className="w-full rounded-[12px] border border-[#c5e8e4] bg-[#F1F1F5] px-2.5 py-2.5 shadow-sm sm:rounded-[14px] sm:px-4 sm:py-3.5 lg:max-w-none">
                <p className="font-sans text-[11px] font-semibold tracking-normal text-[#5f6168] sm:text-[12px]">
                  Дата отправки
                </p>
                <p className="mt-1.5 text-balance font-sans text-[14px] font-medium leading-snug text-[#0A7772] sm:mt-2 sm:text-[15px]">
                  {selectedDateLine}
                </p>
                <label
                  htmlFor="mailing-time"
                  className="mt-3 block font-sans text-[11px] font-semibold tracking-normal text-[#5f6168] sm:mt-3.5 sm:text-[12px]"
                >
                  Время
                </label>
                <input
                  id="mailing-time"
                  type="time"
                  value={timeValue}
                  onChange={(e) => onTimeInputChange(e.target.value)}
                  className="mt-1.5 w-full max-w-full cursor-pointer rounded-lg border-2 border-[#17C7BE] bg-[#FBFBFB] px-2.5 py-2 text-[15px] font-normal text-[#0A7772] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#056F69]/25 sm:mt-2 sm:max-w-[220px] sm:text-[16px]"
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-4 lg:pt-0.5">
              <div>
                <label
                  htmlFor="mailing-email"
                  className="mb-1.5 block font-sans text-[11px] font-semibold tracking-normal text-[#5f6168] sm:mb-2 sm:text-[12px]"
                >
                  Почта получателей
                </label>
                <div className="flex h-[32px]  items-center rounded-[8px] border-2 border-[#17C7BE] bg-[#FBFBFB] pl-3 pr-1 shadow-sm sm:h-[34px]">
                  <input
                    id="mailing-email"
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "," || e.key === ";") {
                        e.preventDefault();
                        commitEmails();
                      }
                    }}
                    onBlur={commitEmails}
                    placeholder="Введите почту"
                    className="w-full min-w-0 bg-transparent text-[14px] font-normal text-[#0A7772] placeholder:text-[#BCBAC4] focus:outline-none sm:text-[15px]"
                  />
                  <button
  type="button"
  onClick={commitEmails}
  aria-label="Добавить почту"
  className="ml-1.5 flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-[#0b7a73] text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#09665f] sm:h-[28px] sm:w-[28px]"
>
  <Check className="h-3 w-3" size={12} color="white" strokeWidth={2.5} />
</button>
                </div>
              </div>

              <section>
                <label className="mb-1.5 block font-sans text-[11px] font-semibold tracking-normal text-[#5f6168] sm:mb-2 sm:text-[12px]">
                  Добавленные почты
                </label>
                <div className="flex max-h-[132px] flex-col gap-1.5 overflow-y-auto pr-0.5 sm:max-h-[144px]">
                  {emails.length === 0 ? (
                    <p className="rounded-[10px] border border-dashed border-[#c8d5d4] bg-white/80 px-2.5 py-2.5 text-center text-[12px] text-[#8C8991] sm:px-3 sm:py-2.5 sm:text-[13px]">
                      Добавьте один или несколько адресов.
                    </p>
                  ) : (
                    emails.map((email, idx) => (
                      <div
                        key={`${email}-${idx}`}
                        className="flex h-[28px] items-center rounded-full border border-[#B8B5BE] bg-[#F5F5F8] pl-1.5 pr-2 sm:h-[30px] sm:pl-2 sm:pr-2.5"
                      >
                        <button
                          type="button"
                          aria-label={`Удалить ${email}`}
                          onClick={() => setEmails((prev) => prev.filter((x) => x !== email))}
                          className="mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8C8991] transition hover:bg-[#fde8e8] hover:text-[#a02828] sm:mr-2"
                        >
                          <X className="h-3 w-3" strokeWidth={2.2} />
                        </button>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-normal text-[#0A7772] sm:text-[14px]">{email}</span>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 sm:mb-2">
                  <label
                    htmlFor="mailing-comment"
                    className="font-heading text-[13px] font-bold leading-none text-[#2f3138] sm:text-[14px]"
                  >
                    Комментарий
                  </label>
                  <span
                    className={`shrink-0 font-sans text-[11px] tabular-nums sm:text-[12px] ${
                      comment.length >= MAILING_COMMENT_MAX_LENGTH
                        ? "font-medium text-[#a02828]"
                        : comment.length > MAILING_COMMENT_MAX_LENGTH * 0.9
                        ? "text-[#8a6a2c]"
                        : "text-[#8C8991]"
                    }`}
                  >
                    {comment.length} / {MAILING_COMMENT_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  id="mailing-comment"
                  value={comment}
                  maxLength={MAILING_COMMENT_MAX_LENGTH}
                  onChange={(e) =>
                    setComment(e.target.value.slice(0, MAILING_COMMENT_MAX_LENGTH))
                  }
                  placeholder="Введите комментарий"
                  rows={4}
                  className="min-h-[96px] max-h-[200px] w-full resize-y overflow-y-auto rounded-[14px] border border-[#BDBAC3] bg-[#FBFBFB] px-3 py-2 text-[13px] font-normal leading-relaxed text-[#0A7772] placeholder:text-[#BCBAC4] focus:outline-none focus:ring-2 focus:ring-[#17C7BE]/30 sm:min-h-[112px] sm:max-h-[220px] sm:rounded-[16px] sm:px-3.5 sm:py-2.5 sm:text-[14px]"
                />
              </section>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-[#d9d6de]/80 pt-2.5 sm:gap-2 sm:pt-3">
            <span className="w-full font-heading text-[12px] font-bold tracking-normal text-[#2f3138] sm:w-auto sm:pr-1.5 sm:text-[13px]">
              Повтор
            </span>
            {(["none", "day", "week", "month"] as MailingRepeat[]).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setRepeat(opt)}
                className={`rounded-full border px-2.5 py-1 font-sans text-[11px] font-medium transition sm:px-3 sm:py-1.5 sm:text-[12px] ${
                  repeat === opt
                    ? "border-[#0b7a73] bg-[#e1f6f3] text-[#0b7a73]"
                    : "border-[#C3D4D3] bg-white text-[#5f6168] hover:bg-[#f4fbfb]"
                }`}
              >
                {repeatLabel(opt)}
              </button>
            ))}
          </div>

          {formError || successText ? (
            <p
              className={`rounded-[10px] border px-3 py-2 font-sans text-[13px] leading-relaxed sm:px-3.5 sm:py-2.5 sm:text-[14px] ${
                formError
                  ? "border-[#e8b4b4] bg-[#fff5f5] text-[#8a2c2c]"
                  : "border-[#b8e0dc] bg-[#eef9f7] text-[#0b7a73]"
              }`}
            >
              {formError ?? successText}
            </p>
          ) : null}

          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting || messageId == null}
              className="flex py-2 w-full items-center justify-center gap-2 rounded-[7px] bg-[#0b7a73] px-4 text-center font-heading text-[15px] font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-[#09665f] hover:shadow-sm disabled:pointer-events-none disabled:opacity-55 sm:h-[46px] sm:text-[16px]"
            >
              {submitting ? "Отправляю..." : "Отправить"}
            </button>
          </div>
        </div>
        </section>
      </div>
    </div>
  );
}
function ChatGroup({
  chatId,
  title,
  active,
  expanded,
  queries,
  selectedQueryMessageId,
  workspaceChatId,
  workspaceSql,
  onSelectRoot,
  onSelectLeaf,
  onRename,
  onDelete,
  onCopyChatSql,
  onCopyLeafSql,
}: {
  chatId: number;
  title: string;
  active?: boolean;
  expanded?: boolean;
  queries: SidebarQueryLeaf[];
  selectedQueryMessageId?: number | null;
  workspaceChatId?: number | null;
  workspaceSql?: string | null;
  onSelectRoot?: () => void;
  onSelectLeaf?: (messageId: number) => void;
  onRename?: (nextName: string) => void;
  onDelete?: () => void;
  onCopyChatSql?: () => void;
  onCopyLeafSql?: (messageId: number) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nextTitle, setNextTitle] = useState(title);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);

  const canCopyRootSql =
    workspaceChatId != null &&
    workspaceChatId === chatId &&
    typeof workspaceSql === "string" &&
    workspaceSql.trim().length > 0;

  const openRename = () => {
    setNextTitle(title);
    setIsRenaming(true);
    setIsDeleteConfirm(false);
  };

  const cancelRename = () => {
    setIsRenaming(false);
    setNextTitle(title);
  };

  const submitRename = () => {
    const trimmed = nextTitle.trim();
    if (!trimmed) return;
    onRename?.(trimmed);
    setIsRenaming(false);
  };

  return (
    <div className="w-full">
      <div
        className={`relative flex h-[54px] w-full items-stretch overflow-hidden rounded-[12px] shadow-sm ${
          active ? "bg-[#dceef2]" : "bg-[#eceaf2]"
        } transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-sm`}
      >
        <span
          className={`pointer-events-none absolute left-0 top-0 h-full w-[4px] rounded-l-[12px] ${
            active ? "bg-[#0b9d97]" : "bg-[#5f6168]"
          }`}
        />
        {isRenaming ? (
          <div className="flex min-w-0 flex-1 items-center gap-2 py-0 pl-7 pr-1">
            <MessageSquare
              className={`h-[16px] w-[16px] shrink-0 ${active ? "text-[#0b9d97]" : "text-[#6a6c73]"}`}
              strokeWidth={1.8}
            />
            <input
              value={nextTitle}
              onChange={(e) => setNextTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitRename();
                if (e.key === "Escape") cancelRename();
              }}
              className="min-w-0 flex-1 rounded-md border border-[#cfd3db] bg-white px-2 py-1 text-[14px] leading-none text-[#2d2e33] outline-none focus:border-[#0b9d97]"
              autoFocus
            />
            <button
              type="button"
              className="rounded-md p-1.5 text-[#0b9d97] transition-colors hover:bg-black/[0.06]"
              aria-label="Сохранить название чата"
              onClick={submitRename}
            >
              <Check className="h-[16px] w-[16px]" strokeWidth={2} />
            </button>
            <button
              type="button"
              className="rounded-md p-1.5 transition-colors hover:bg-black/[0.06]"
              aria-label="Отменить переименование"
              onClick={cancelRename}
            >
              <X className="h-[16px] w-[16px]" strokeWidth={2} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-3 py-0 pl-7 pr-1 text-left"
            onClick={() => onSelectRoot?.()}
          >
            <MessageSquare
              className={`h-[16px] w-[16px] shrink-0 ${active ? "text-[#0b9d97]" : "text-[#6a6c73]"}`}
              strokeWidth={1.8}
            />
            <span
              className={`truncate text-[16px] font-semibold leading-none ${
                active ? "text-[#0b9d97]" : "text-[#5f6168]"
              }`}
            >
              {title}
            </span>
          </button>
        )}
        {!isRenaming && (
          <div
            className={`flex shrink-0 items-center gap-0.5 pr-1 ${active ? "text-[#0b9d97]" : "text-[#6a6c73]"}`}
            onClick={(e) => e.stopPropagation()}
          >
           
            <button
              type="button"
              className="rounded-md p-1.5 transition-colors hover:bg-black/[0.06]"
              aria-label="Переименовать чат"
              title="Переименовать"
              onClick={openRename}
            >
              <Pencil className="h-[16px] w-[16px]" strokeWidth={1.8} />
            </button>
            {isDeleteConfirm ? (
              <div className="ml-1 inline-flex items-center gap-1 rounded-md border border-[#d8dbe3] bg-white px-1 py-0.5">
                <button
                  type="button"
                  className="rounded-md p-1 text-[#0b9d97] transition-colors hover:bg-black/[0.06]"
                  aria-label="Подтвердить удаление чата"
                  onClick={() => {
                    setIsDeleteConfirm(false);
                    onDelete?.();
                  }}
                >
                  <Check className="h-[14px] w-[14px]" strokeWidth={2.1} />
                </button>
                <button
                  type="button"
                  className="rounded-md p-1 transition-colors hover:bg-black/[0.06]"
                  aria-label="Отменить удаление чата"
                  onClick={() => setIsDeleteConfirm(false)}
                >
                  <X className="h-[14px] w-[14px]" strokeWidth={2.1} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="rounded-md p-1.5 transition-colors hover:bg-black/[0.06]"
                aria-label="Удалить чат"
                title="Удалить"
                onClick={() => {
                  setIsDeleteConfirm(true);
                  setIsRenaming(false);
                }}
              >
                <Trash2 className="h-[16px] w-[16px]" strokeWidth={1.8} />
              </button>
            )}
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-[6px]">
          {queries.length === 0 ? (
            <p className="pl-8 pr-2 text-[13px] leading-snug text-[#8d8d93]">В этом чате пока нет запросов.</p>
          ) : (
            queries.map((q) => {
              const picked = selectedQueryMessageId === q.id;
              return (
                <div key={q.id} className="relative flex min-h-[28px] items-start gap-1 pl-3 transition-colors duration-200 hover:bg-black/[0.02]">
                  <span className="absolute left-[0px] top-0 h-full w-px bg-[#6d6f76]" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer rounded-md py-0.5 pl-8 pr-1 text-left transition-colors hover:bg-black/[0.03]"
                    onClick={() => onSelectLeaf?.(q.id)}
                  >
                    <div
                      className={`line-clamp-2 text-left text-[14px] leading-snug ${
                        picked ? "font-medium text-[#0b9d97]" : "text-[#747780]"
                      }`}
                    >
                      {q.text}
                    </div>
                  </button>
                
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SqlCodeSkeleton() {
  return (
    <div className="t2s-enter t2s-skeleton-stagger space-y-2 pt-1" aria-hidden>
      <div className="h-2.5 w-[88%] rounded-full bg-[#d0ccc9]" />
      <div className="h-2.5 w-[62%] rounded-full bg-[#d0ccc9]" />
      <div className="h-2.5 w-full rounded-full bg-[#d0ccc9]" />
      <div className="h-2.5 w-[72%] rounded-full bg-[#d0ccc9]" />
    </div>
  );
}

const LOADING_PHRASES = [
  "Анализирую базу данных…",
  "Формирую SQL-запрос…",
  "Строю графики для вас…",
  "Собираю таблицу с результатами…",
];

function LoadingAnswerBlock({
  phraseIndex,
  hasSql,
  hasData,
}: {
  phraseIndex: number;
  hasSql: boolean;
  hasData: boolean;
}) {
  return (
    <article className="rounded-[10px] border border-[#e5e2e8] bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-[12px] font-bold tracking-normal text-[#0b7a73]">Ответ</h2>
        <Sparkles className="h-6 w-6 shrink-0 animate-pulse text-[#0b7a73]" strokeWidth={1.5} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {hasSql ? <DonePill label="Создан SQL" /> : <GhostPill label="Создан SQL" />}
        {hasData ? <DonePill label="Таблица готова" /> : <GhostPill label="Таблица готова" />}
        {hasData ? <DonePill label="График готов" /> : <GhostPill label="График готов" />}
      </div>

      <div className="mt-8 flex flex-col items-center gap-5 py-4">
        <div className="h-10 w-10 rounded-full border-2 border-[#d9d5dd] border-t-[#0b7a73] motion-safe:animate-spin" />
        <p key={phraseIndex} className="t2s-phrase-in text-center text-[15px] leading-7 text-[#4b4d55]">
          {LOADING_PHRASES[phraseIndex % LOADING_PHRASES.length]}
        </p>
      </div>
    </article>
  );
}

function PanelSkeleton({ title, tall }: { title: string; tall?: boolean }) {
  return (
    <article className="overflow-hidden rounded-[10px] border border-[#e5e2e8] bg-white shadow-sm">
      <header className="flex items-center justify-between bg-[#f8f6fa] px-5 py-4">
        <h3 className="font-heading text-[13px] font-bold text-[#2f3138]">{title}</h3>
        <div className="h-4.5 w-4.5 shrink-0 rounded-full bg-[#e0dde4] motion-safe:animate-pulse" aria-hidden />
      </header>
      <div
        className={`t2s-skeleton-stagger space-y-2 px-5 py-5 ${tall ? "min-h-[180px]" : "min-h-[120px]"}`}
      >
        <div className="h-3 w-full rounded-lg bg-[#ece8ee]" />
        <div className="h-3 w-[92%] rounded-lg bg-[#ece8ee]" />
        <div className="h-3 w-[78%] rounded-lg bg-[#ece8ee]" />
      </div>
    </article>
  );
}

function GhostPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dad8de] bg-[#f5f4f7] px-3 py-1.5 text-[12px] font-medium text-[#8c8f97]">
      <span className="h-3 w-3 rounded-full border border-[#cfcdd4] border-t-[#0b7a73] motion-safe:animate-spin" />
      {label}
    </span>
  );
}

function DonePill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#cceae6] bg-[#f2fbf9] px-3 py-1.5 text-[12px] font-medium text-[#0b7a73]">
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0b7a73] text-[9px] font-bold text-white">
        ✓
      </span>
      {label}
    </span>
  );
}