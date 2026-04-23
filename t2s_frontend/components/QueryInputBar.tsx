"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";

type QueryInputBarProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (nextValue?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Ширина и внешние отступы: например `mx-auto mt-14 w-2/3` или `w-full`. */
  className?: string;
};

export function QueryInputBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Что вы хотите найти?",
  disabled = false,
  className = "",
}: QueryInputBarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [draftValue, setDraftValue] = useState(value);
  const hasQuery = draftValue.trim().length > 0;
  const focusInput = () => inputRef.current?.focus();

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSubmit(event.currentTarget.value);
    }
  };

  const onInputResize = (event: FormEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    target.style.height = "auto";
    target.style.height = `${target.scrollHeight}px`;
  };

  const submit = () => {
    const next = (inputRef.current?.value ?? draftValue).trim();
    if (!next) return;
    onSubmit(next);
  };

  return (
    <form
      className={`flex items-center gap-3 rounded-2xl border border-[#E4E4E4] bg-[#F4F4F4] px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.07)] ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onMouseDown={(event) => {
        if ((event.target as HTMLElement).closest("button")) return;
        event.preventDefault();
        focusInput();
      }}
    >
      <div
        className="relative flex min-w-0 flex-1 items-center gap-2.5 px-0.5 transition-all duration-300 ease-out"
        onClick={focusInput}
      >
        <Sparkles size={16} className="shrink-0 text-[#006B62]" strokeWidth={2} />
        <textarea
          ref={inputRef}
          value={draftValue}
          onChange={(event) => {
            const next = event.currentTarget.value;
            setDraftValue(next);
            onChange(next);
          }}
          onInput={onInputResize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="t2s-query-area max-h-28 min-h-[26px] w-full resize-none overflow-y-auto bg-transparent pl-1 text-[14px] leading-6 text-[#232530] outline-none placeholder:text-[#9CA3AF] disabled:opacity-50"
        />
        <span
          className={`pointer-events-none absolute bottom-0 left-[1.85rem] h-[2px] w-[calc(100%-2rem)] origin-left rounded bg-[#006B62] transition-transform duration-300 ${
            isFocused ? "scale-x-100" : "scale-x-0"
          }`}
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className={`flex min-h-[38px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#80B1AC] py-2 text-[13px] font-medium text-white shadow-[0_2px_8px_rgba(90,120,115,0.35)] transition-[width,padding,opacity] duration-300 ease-out hover:brightness-95 disabled:pointer-events-none disabled:opacity-50 ${
          hasQuery ? "w-11 px-0" : "min-w-[112px] px-4"
        }`}
      >
        <span
          className={`whitespace-nowrap transition-all duration-200 ${
            hasQuery ? "mr-0 max-w-0 overflow-hidden opacity-0" : "mr-1.5 max-w-[5rem] opacity-100"
          }`}
        >
          Поиск
        </span>
        <ArrowRight size={14} strokeWidth={2.2} className="shrink-0" />
      </button>
    </form>
  );
}
