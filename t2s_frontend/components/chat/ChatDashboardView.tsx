"use client";

import Image from "next/image";
import { Copy, Download, Pencil, Plus, Share2, Sparkles, Trash2 } from "lucide-react";
import { QueryInputBar } from "@/components/QueryInputBar";
import { MessageSquare } from "lucide-react";
export type DashboardPhase = "idle" | "loading" | "ready";

export type SidebarQueryLeaf = { id: number; text: string };

export type SidebarChatItem = {
  id: number;
  title: string;
  active?: boolean;
  /** Раскрыт список подчатов (запросов пользователя) в сайдбаре */
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
  barPercents: number[];
  pieA: number;
  pieB: number;
  pieAngle: number;
  forceTableChartSkeleton?: boolean;
  sidebarChats?: SidebarChatItem[];
  onNewChat?: () => void;
  onSelectChat?: (chatId: number) => void;
  onSelectChatQuery?: (chatId: number, messageId: number) => void;
  selectedQueryMessageId?: number | null;
  newChatPending?: boolean;
  /** Текущий открытый чат (для копирования SQL в шапке строки) */
  workspaceChatId?: number | null;
  /** SQL, показанный справа, если относится к workspaceChatId */
  workspaceSql?: string | null;
  onRenameChat?: (chatId: number) => void;
  onDeleteChat?: (chatId: number) => void;
  onCopyChatSql?: (chatId: number) => void;
  onCopyLeafSql?: (chatId: number, messageId: number) => void;
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  return String(value);
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
  barPercents,
  pieA,
  pieB,
  pieAngle,
  forceTableChartSkeleton = false,
  sidebarChats = [],
  onNewChat,
  onSelectChat,
  onSelectChatQuery,
  selectedQueryMessageId = null,
  newChatPending = false,
  workspaceChatId = null,
  workspaceSql = null,
  onRenameChat,
  onDeleteChat,
  onCopyChatSql,
  onCopyLeafSql,
}: ChatDashboardViewProps) {
  const showBubble = userBubble.length > 0 && (phase === "loading" || phase === "ready");
  const copySource = sqlCopyText ?? sqlText ?? "";

  return (
    <>
      <div className="flex items-center h-[10dvh] px-5">
        <Image src="/t2slogo.svg" alt="T2S" width={96} height={44} priority />
      </div>
    <div className="flex h-[90dvh] min-h-0 w-full bg-[#FBF8FC] text-[#26262b]">
      <aside className="flex min-h-0 w-1/5 shrink-0 flex-col ">
        

        <div className="flex min-h-0 flex-1 flex-col bg-[#F5F3F8] rounded-tr-[50px] p-6">
          <div className="mb-4">
            <p className="font-[var(--font-futuraround)] text-[20px] font-bold uppercase leading-none text-[#2d2e33]">
              ЧАТЫ
            </p>
            <p className="mt-1 text-[12px] leading-snug text-[#8d8d93]">Все чаты и запросы в них</p>
          </div>

          <button
            type="button"
            disabled={newChatPending}
            className="mb-4 inline-flex w-[142px] items-center justify-center gap-2 rounded-[7px] bg-[#0b7a73] px-4 py-2 text-[14px] font-semibold text-white shadow-[0_6px_16px_rgba(11,122,115,0.28)] transition-colors hover:bg-[#09665f] disabled:pointer-events-none disabled:opacity-60"
            onClick={() => onNewChat?.()}
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Новый чат
          </button>

          <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
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
                  onSelectLeaf={(messageId) => onSelectChatQuery?.(c.id, messageId)}
                  onRename={() => onRenameChat?.(c.id)}
                  onDelete={() => onDeleteChat?.(c.id)}
                  onCopyChatSql={() => onCopyChatSql?.(c.id)}
                  onCopyLeafSql={(messageId) => onCopyLeafSql?.(c.id, messageId)}
                />
              ))
            )}
          </nav>
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col bg-[#fbfafc] px-5 pt-6">
        <div className="flex-1 overflow-y-auto pb-36">
          <div className="mx-auto max-w-[860px]">
            {phase === "idle" && (
              <div className="mx-auto mt-24 flex h-[260px] max-w-[620px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#d8d5dd] bg-white/80 px-8 text-center shadow-[0_2px_14px_rgba(0,0,0,0.04)]">
                <Sparkles className="mb-3 h-8 w-8 text-[#0b7a73]/70" strokeWidth={1.6} />
                <p className="text-[15px] leading-7 text-[#8f8f96]">
                  Задайте вопрос в поле ниже — здесь появятся ответ, таблица и график.
                </p>
              </div>
            )}

            {phase === "loading" && (
              <div className="mx-auto flex max-w-[600px] flex-col gap-5">
                {showBubble && (
                  <div className="ml-auto max-w-[90%] rounded-[10px] bg-[#b9efe7] px-5 py-3 text-[14px] leading-6 text-[#283136] shadow-[0_6px_18px_rgba(11,122,115,0.14)]">
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

            {phase === "ready" && (
              <div className="mx-auto flex max-w-[600px] flex-col gap-5">
                {showBubble && (
                  <div className="ml-auto max-w-[90%] rounded-[10px] bg-[#b9efe7] px-5 py-3 text-[14px] leading-6 text-[#283136] shadow-[0_6px_18px_rgba(11,122,115,0.14)]">
                    {userBubble}
                  </div>
                )}

                <article className="rounded-[10px] border border-[#e5e2e8] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
                  <h2 className="font-[var(--font-futuraround)] text-[12px] font-bold uppercase tracking-[0.06em] text-[#0b7a73]">
                    ОТВЕТ
                  </h2>
                  <p className="mt-1 text-[12px] leading-snug text-[#8d8d93]">
                    Что делает запрос и какой это отчёт для пользователя
                  </p>
                  <p className="mt-4 line-clamp-4 max-h-[7.5rem] whitespace-pre-line text-[15px] leading-7 text-[#4b4d55] [overflow-wrap:anywhere]">
                    {summaryText || "—"}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <DonePill label="SQL создан" />
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
                    <article className="overflow-hidden rounded-[10px] border border-[#e5e2e8] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
                      <header className="flex items-center justify-between bg-[#f8f6fa] px-5 py-4">
                        <h3 className="font-[var(--font-futuraround)] text-[13px] font-bold text-[#2f3138]">Таблица</h3>
                        <div className="flex gap-3 text-[#666873]">
                          <button type="button" className="rounded-full p-1.5 hover:bg-black/5" aria-label="Скачать">
                            <Download className="h-4.5 w-4.5" strokeWidth={1.6} />
                          </button>
                          <button type="button" className="rounded-full p-1.5 hover:bg-black/5" aria-label="Поделиться">
                            <Share2 className="h-4.5 w-4.5" strokeWidth={1.6} />
                          </button>
                        </div>
                      </header>

                      <div className="overflow-x-auto px-2 pb-4 pt-2">
                        {columns.length === 0 ? (
                          <p className="px-4 py-8 text-center text-[14px] text-[#8C8C8C]">Нет данных для отображения.</p>
                        ) : (
                          <table className="w-full min-w-[320px] border-separate border-spacing-0 text-left text-[13px]">
                            <thead>
                              <tr className="text-[#8b8d94]">
                                {columns.map((col, i) => (
                                  <th
                                    key={col}
                                    className={`bg-[#faf9fb] px-4 py-3 font-medium ${
                                      i === 0 ? "rounded-l-xl" : ""
                                    } ${i === columns.length - 1 ? "rounded-r-xl" : ""}`}
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, ri) => (
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
                    </article>

                    <article className="overflow-hidden rounded-[10px] border border-[#e5e2e8] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
                      <header className="flex items-center justify-between bg-[#f8f6fa] px-5 py-4">
                        <h3 className="font-[var(--font-futuraround)] text-[13px] font-bold text-[#2f3138]">График</h3>
                        <div className="flex gap-3 text-[#666873]">
                          <button type="button" className="rounded-full p-1.5 hover:bg-black/5" aria-label="Скачать">
                            <Download className="h-4.5 w-4.5" strokeWidth={1.6} />
                          </button>
                          <button type="button" className="rounded-full p-1.5 hover:bg-black/5" aria-label="Поделиться">
                            <Share2 className="h-4.5 w-4.5" strokeWidth={1.6} />
                          </button>
                        </div>
                      </header>

                      <div className="flex flex-wrap items-end justify-between gap-8 px-5 py-6">
                        <div className="flex h-40 min-w-[240px] flex-1 items-end justify-center gap-3 sm:justify-start">
                          {barPercents.map((h, i) => (
                            <div key={i} className="flex w-9 flex-col items-center gap-2">
                              <div
                                className="w-full max-w-8 rounded-full border border-[#71c8c3] bg-transparent"
                                style={{ height: `${Math.max(28, Math.round((h / 100) * 120))}px` }}
                              />
                              <span className="text-[11px] tabular-nums text-[#3d4048]">{i + 1}</span>
                            </div>
                          ))}
                        </div>

                        <div
                          className="relative mx-auto h-36 w-36 shrink-0 rounded-full border border-[#71c8c3] shadow-[0_4px_14px_rgba(0,0,0,0.05)]"
                          style={{
                            background: `conic-gradient(#71c8c3 0deg ${pieAngle}deg, transparent ${pieAngle}deg 360deg)`,
                          }}
                        >
                          <span className="absolute left-[22%] top-[28%] text-[12px] font-semibold text-[#2f3138]">
                            {pieA}
                          </span>
                          <span className="absolute bottom-[24%] right-[18%] text-[12px] font-semibold text-[#2f3138]">
                            {pieB}
                          </span>
                        </div>
                      </div>
                    </article>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#fbfafc] via-[#fbfafc] to-transparent pb-4 pt-10">
          <div className="pointer-events-auto mx-auto max-w-[760px] px-5">
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

      <aside className="flex min-h-0 w-1/5 shrink-0 flex-col ">
        <div className="flex min-h-0 flex-1 flex-col bg-[#F5F3F8] rounded-tl-[50px] p-6">
          <h2 className="font-[var(--font-futuraround)] text-[18px] font-bold uppercase leading-[1.05] text-[#2d2e33]">
            ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ
          </h2>

          <p className="mt-2 text-[11px] uppercase tracking-[0.08em] text-[#8d8d93]">SQL КОД</p>

          <div className="relative mt-3 min-h-[196px] rounded-[10px] bg-[#e8e4ea] p-4">
            {sqlText ? (
              <>
                <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[#6a7080]">
                  {sqlText}
                </pre>
                <button
                  type="button"
                  className="absolute bottom-3 right-3 rounded-[10px] bg-[#d0ccc9] p-2 text-[#7a7d84]"
                  aria-label="Копировать SQL"
                  onClick={() => void navigator.clipboard?.writeText(copySource)}
                >
                  <Copy className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </>
            ) : phase === "loading" ? (
              <div className="space-y-2 pt-1">
                <div className="h-2.5 w-[88%] rounded-full bg-[#d9d5dd] motion-safe:animate-pulse" />
                <div className="h-2.5 w-[62%] rounded-full bg-[#d9d5dd] motion-safe:animate-pulse" />
                <div className="h-2.5 w-full rounded-full bg-[#d9d5dd] motion-safe:animate-pulse" />
                <div className="h-2.5 w-[72%] rounded-full bg-[#d9d5dd] motion-safe:animate-pulse" />
              </div>
            ) : (
              <p className="pt-2 text-[13px] leading-6 text-[#8d8d93]">Здесь появится сгенерированный SQL.</p>
            )}
          </div>

          <div className="mt-6">
            <p className="text-[18px] font-bold uppercase leading-none text-[#0b7a73]">СКАЧИВАНИЕ</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-full bg-[#e1f6f3] px-4 py-2 text-[13px] font-semibold text-[#0b7a73]">
                Скачать Excel
              </button>
              <button type="button" className="rounded-full bg-[#e1f6f3] px-4 py-2 text-[13px] font-semibold text-[#0b7a73]">
                Скачать PDF
              </button>
              <button type="button" className="rounded-full bg-[#e1f6f3] px-4 py-2 text-[13px] font-semibold text-[#0b7a73]">
                Скачать DOCX
              </button>
            </div>
          </div>

          <div className="mt-auto rounded-[16px] border border-[#e0dde4] bg-white px-4 py-4 shadow-[0_4px_14px_rgba(0,0,0,0.05)]">
            <p className="text-[18px] font-bold uppercase leading-none text-[#0b7a73]">РАССЫЛКА</p>
            <button
              type="button"
              className="mt-4 w-full rounded-[12px] bg-[#c0eeea] py-3 text-[14px] font-semibold text-[#0b7a73] transition-colors hover:bg-[#b4e8e3]"
            >
              Отправить ссылку
            </button>
          </div>
        </div>
      </aside>
    </div>
    </>
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
  onRename?: () => void;
  onDelete?: () => void;
  onCopyChatSql?: () => void;
  onCopyLeafSql?: (messageId: number) => void;
}) {
  const canCopyRootSql =
    workspaceChatId != null &&
    workspaceChatId === chatId &&
    typeof workspaceSql === "string" &&
    workspaceSql.trim().length > 0;

  return (
    <div className="w-full">
      <div
        className={`relative flex h-[54px] w-full items-stretch overflow-hidden rounded-[12px] ${
          active ? "bg-[#dceef2]" : "bg-[#eceaf2]"
        }`}
      >
        <span
          className={`pointer-events-none absolute left-0 top-0 h-full w-[4px] rounded-l-[12px] ${
            active ? "bg-[#0b9d97]" : "bg-[#5f6168]"
          }`}
        />
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
        <div
          className={`flex shrink-0 items-center gap-0.5 pr-1 ${active ? "text-[#0b9d97]" : "text-[#6a6c73]"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="rounded-md p-1.5 transition-colors hover:bg-black/[0.06] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Копировать SQL текущего запроса"
            title="Копировать SQL"
            disabled={!canCopyRootSql}
            onClick={() => onCopyChatSql?.()}
          >
            <Copy className="h-[16px] w-[16px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 transition-colors hover:bg-black/[0.06]"
            aria-label="Переименовать чат"
            title="Переименовать"
            onClick={() => onRename?.()}
          >
            <Pencil className="h-[16px] w-[16px]" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 transition-colors hover:bg-black/[0.06]"
            aria-label="Удалить чат"
            title="Удалить"
            onClick={() => onDelete?.()}
          >
            <Trash2 className="h-[16px] w-[16px]" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 space-y-[6px]">
          {queries.length === 0 ? (
            <p className="pl-8 pr-2 text-[13px] leading-snug text-[#8d8d93]">В этом чате пока нет запросов.</p>
          ) : (
            queries.map((q) => {
              const picked = selectedQueryMessageId === q.id;
              return (
                <div key={q.id} className="relative flex min-h-[28px] items-start gap-1 pl-3">
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
                  <button
                    type="button"
                    className="mt-0.5 shrink-0 rounded p-1 text-[#6a6c73] transition-colors hover:bg-black/[0.06] hover:text-[#0b9d97]"
                    aria-label="Копировать SQL этого запроса"
                    title="Копировать SQL"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCopyLeafSql?.(q.id);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
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
    <article className="rounded-[10px] border border-[#e5e2e8] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[var(--font-futuraround)] text-[12px] font-bold uppercase tracking-[0.06em] text-[#0b7a73]">
          ОТВЕТ
        </h2>
        <Sparkles className="h-6 w-6 shrink-0 animate-pulse text-[#0b7a73]" strokeWidth={1.5} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {hasSql ? <DonePill label="SQL создан" /> : <GhostPill label="SQL создан" />}
        {hasData ? <DonePill label="Таблица готова" /> : <GhostPill label="Таблица готова" />}
        {hasData ? <DonePill label="График готов" /> : <GhostPill label="График готов" />}
      </div>

      <div className="mt-8 flex flex-col items-center gap-5 py-4">
        <div className="h-10 w-10 rounded-full border-2 border-[#d9d5dd] border-t-[#0b7a73] motion-safe:animate-spin" />
        <p key={phraseIndex} className="text-center text-[15px] leading-7 text-[#4b4d55]">
          {LOADING_PHRASES[phraseIndex % LOADING_PHRASES.length]}
        </p>
      </div>
    </article>
  );
}

function PanelSkeleton({ title, tall }: { title: string; tall?: boolean }) {
  return (
    <article className="overflow-hidden rounded-[10px] border border-[#e5e2e8] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
      <header className="flex items-center justify-between bg-[#f8f6fa] px-5 py-4">
        <h3 className="font-[var(--font-futuraround)] text-[13px] font-bold text-[#2f3138]">{title}</h3>
        <div className="flex gap-3 text-[#666873]">
          <Download className="h-4.5 w-4.5" strokeWidth={1.6} />
          <Share2 className="h-4.5 w-4.5" strokeWidth={1.6} />
        </div>
      </header>
      <div className={`space-y-2 px-5 py-5 ${tall ? "min-h-[180px]" : "min-h-[120px]"}`}>
        <div className="h-3 w-full rounded-lg bg-[#ece8ee] motion-safe:animate-pulse" />
        <div className="h-3 w-[92%] rounded-lg bg-[#ece8ee] motion-safe:animate-pulse" />
        <div className="h-3 w-[78%] rounded-lg bg-[#ece8ee] motion-safe:animate-pulse" />
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