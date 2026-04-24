"use client";

import Image from "next/image";
import { Briefcase, GraduationCap,ArrowRight, Users, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QueryInputBar } from "@/components/QueryInputBar";

const EXAMPLES: { text: string; icon: LucideIcon }[] = [
  { text: "Сколько людей имеет высшее образование?", icon: GraduationCap },
  { text: "Какая средняя зарплата по отделу?", icon: Briefcase },
  { text: "Сколько человек старше 35 работает в офисе?", icon: Users },
];

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const submitQuery = (nextValue?: string) => {
    const text = (nextValue ?? query).trim();
    if (!text) return;
    sessionStorage.setItem("t2s:pendingText", text);
    router.push("/chat");
  };

  const handleSuggestionClick = (text: string) => {
    if (query.trim().length === 0) {
      setQuery(text);
    }
  };

  const handleGoWorkspace = () => {
    router.push("/chat");
  };

  return (
    <main className="min-h-screen bg-[#FBF8FC] px-4 pb-16 pt-5 sm:px-5 md:px-10 md:pb-20 md:pt-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="transition-transform duration-300 ease-out hover:scale-[1.03]">
          <Image src="/t2slogo.svg" alt="T2S logo" width={98} height={64} priority unoptimized />
        </div>
        <button
          type="button"
          onClick={handleGoWorkspace}
          className="group inline-flex items-center justify-center gap-2 py-2 font-[var(--font-futuraround)] text-[14px] font-semibold text-[#0b7a73] transition-colors hover:text-[#09665f] sm:mt-2 sm:px-3 sm:py-2.5"
        >
          Перейти в рабочую область
          <ArrowRight
            size={14}
            strokeWidth={2.2}
            className="shrink-0 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
          />
        </button>
        </div>
        <section className="mx-auto mt-16 flex w-full flex-col items-center text-center sm:mt-20 md:mt-28">
          <h1 className="font-[var(--font-futuraround)] text-[clamp(32px,8vw,60px)] font-bold leading-[1.14] tracking-[-0.01em] text-[#232530]">
            Сервис преобразования текста в sql
          </h1>
          <h2 className="mt-2 font-[var(--font-futuraround)] text-[clamp(32px,8vw,60px)] font-bold leading-[1.14] tracking-[-0.01em] text-[#006B62]">
            Найдет по простому описанию
          </h2>

          <QueryInputBar className="mx-auto mt-10 w-full max-w-3xl sm:mt-12 md:mt-14 md:w-2/3" value={query} onChange={setQuery} onSubmit={submitQuery} />
          

          <div className="mt-10 flex w-full flex-wrap items-center justify-center gap-3 text-left sm:mt-12">
            <span className="text-[14px] text-[#8C8C8C]">Попробуй спросить:</span>
            {EXAMPLES.map(({ text, icon: Icon }) => (
              <button
                key={text}
                type="button"
                onClick={() => handleSuggestionClick(text)}
                className="flex max-w-full items-center gap-1 rounded-lg bg-white px-4 py-2 text-[13px] text-[#8C8C8C] shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:text-[#6f6f76] hover:shadow-[0_6px_14px_rgba(0,0,0,0.10)]"
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
