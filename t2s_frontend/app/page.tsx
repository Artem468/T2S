"use client";

import Image from "next/image";
import { Briefcase, GraduationCap, Users, type LucideIcon } from "lucide-react";
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

  const submitQuery = () => {
    const text = query.trim();
    if (!text) return;
    sessionStorage.setItem("t2s:pendingText", text);
    router.push("/chat");
  };

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

          <QueryInputBar className="mx-auto mt-14 w-2/3" value={query} onChange={setQuery} onSubmit={submitQuery} />

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
