"use client";

import Image from "next/image";
import { ArrowRight, Briefcase, GraduationCap, Sparkles, Users, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

const EXAMPLES: { text: string; icon: LucideIcon }[] = [
  { text: "Сколько людей имеет высшее образование?", icon: GraduationCap },
  { text: "Какая средняя зарплата по отделу?", icon: Briefcase },
  { text: "Сколько человек старше 35 работает в офисе?", icon: Users },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const focusInput = () => inputRef.current?.focus();
  const hasQuery = query.trim().length > 0;

  const handleSuggestionClick = (text: string) => {
    if (query.trim().length === 0) {
      setQuery(text);
    }
  };

  return (
    <main className="min-h-screen bg-[#FBF8FC] px-5 pb-20 pt-6 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <Image src="/t2slogo.svg" alt="T2S logo" width={98} height={64} priority />

        <section className="mx-auto mt-24 flex w-full  flex-col items-center text-center md:mt-28">
          <h1 className="font-[var(--font-futuraround)] font-bold text-[60px] leading-[1.14] tracking-[-0.01em] text-[#232530] md:text-[56px]">
            Сервис преобразования текста в sql
          </h1>
          <h2 className="mt-2 font-[var(--font-futuraround)] font-bold text-[60px] leading-[1.14] tracking-[-0.01em] text-[#006B62] md:text-[56px]">
            Найдет по простому описанию
          </h2>

          <div
            className="mt-14 flex w-2/3 items-center gap-3 rounded-xl border border-[#DCDCDC] bg-[#F5F6F6] p-6 shadow-[0_3px_14px_rgba(0,0,0,0.16)]"
            onMouseDown={(event) => {
              if ((event.target as HTMLElement).closest("button")) {
                return;
              }
              event.preventDefault();
              focusInput();
            }}
          >
            <div
              className="relative flex min-w-0 flex-1 items-center gap-2 px-1 transition-all duration-300 ease-out"
              onClick={focusInput}
            >
              <Sparkles size={17} className="shrink-0 text-[#006B62]" />
              
              <textarea
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onInput={(event) => {
                  const target = event.currentTarget;
                  target.style.height = "auto";
                  target.style.height = `${target.scrollHeight}px`;
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Что вы хотите найти?"
                rows={1}
                className="t2s-query-area max-h-28 w-full resize-none overflow-y-auto bg-transparent pl-3 text-[15px] leading-7 text-[#232530] outline-none placeholder:text-[#8C8C8C]"
              />
              <span
                className={`pointer-events-none absolute bottom-0 left-9 h-[2px] w-[calc(100%-2.5rem)] origin-left rounded bg-[#006B62] transition-transform duration-300 ${
                  isFocused ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </div>
            <button
              type="button"
              className={`flex min-h-[40px] items-center justify-center overflow-hidden rounded-lg bg-[#006B62] py-2 text-[14px] text-white transition-[width,padding,background-color,color] duration-300 ease-out hover:bg-[#E2FFF9] hover:text-[#006B62] ${
                hasQuery ? "w-12 px-0" : "w-[122px] px-5"
              }`}
            >
              <span
                className={`whitespace-nowrap transition-all duration-200 ${
                  hasQuery ? "mr-0 max-w-0 opacity-0" : "mr-1 max-w-20 opacity-100"
                }`}
              >
                Поиск
              </span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="mt-12 flex w-full flex-wrap items-center justify-center gap-3 text-left">
            <span className="text-[14px] text-[#8C8C8C]">Попробуй спросить:</span>
            {EXAMPLES.map(({ text, icon: Icon }) => (
              <button
                key={text}
                type="button"
                onClick={() => handleSuggestionClick(text)}
                className="flex max-w-full items-start gap-1 rounded-lg bg-white px-4 py-2 text-[13px] text-[#8C8C8C] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
              >
                <Icon size={13} className="text-[#B3B3B3]" />
                <span className="min-w-0 whitespace-normal break-words text-left">{text}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
