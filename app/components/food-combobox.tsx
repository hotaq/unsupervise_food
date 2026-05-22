"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type FoodOption = {
  id: number;
  name_en: string | null;
  name_th: string | null;
  aliases?: string[] | null;
};

export type FoodComboboxProps = {
  inputName?: string;
  hiddenIdName?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  onSelect?: (food: FoodOption | null) => void;
};

function displayName(f: FoodOption): string {
  if (f.name_en && f.name_th) return `${f.name_en} · ${f.name_th}`;
  return f.name_en ?? f.name_th ?? "";
}

function pickName(f: FoodOption, query: string): string {
  const queryHasThai = /[\u0E00-\u0E7F]/.test(query);
  if (queryHasThai) return f.name_th ?? f.name_en ?? "";
  return f.name_en ?? f.name_th ?? "";
}

export function FoodCombobox({
  inputName = "food",
  hiddenIdName = "food_id",
  required,
  placeholder = "e.g. Pad Thai / ผัดไทย",
  className,
  onSelect,
}: FoodComboboxProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FoodOption[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState<FoodOption | null>(null);
  const [loading, setLoading] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const search = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/foods/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          (json && typeof json.error === "string" && json.error) ||
          `HTTP ${res.status}`;
        throw new Error(msg);
      }
      if (abortRef.current !== controller) return;
      setItems((json.items ?? []) as FoodOption[]);
      setActiveIndex((json.items ?? []).length > 0 ? 0 : -1);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("food search failed:", err);
      setItems([]);
      setActiveIndex(-1);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      return;
    }
    debounceRef.current = setTimeout(() => {
      void search(query.trim());
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Click outside closes the listbox.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(item: FoodOption) {
    setSelected(item);
    setQuery(pickName(item, query));
    setOpen(false);
    onSelect?.(item);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        pick(items[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showList = open && (items.length > 0 || loading);
  const hiddenIdValue = useMemo(() => {
    if (!selected) return "";
    const matches =
      query === selected.name_en ||
      query === selected.name_th ||
      query === displayName(selected);
    return matches ? String(selected.id) : "";
  }, [selected, query]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <input
        type="text"
        name={inputName}
        value={query}
        autoComplete="off"
        required={required}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls="food-combobox-list"
        onChange={(e) => {
          const nextQuery = e.target.value;
          setQuery(nextQuery);
          setSelected(null);
          setOpen(true);
          if (!nextQuery.trim()) {
            abortRef.current?.abort();
            setLoading(false);
            setItems([]);
            setActiveIndex(-1);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-base text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100 dark:focus:ring-zinc-100/10"
      />
      <input type="hidden" name={hiddenIdName} value={hiddenIdValue} />

      {showList && (
        <ul
          id="food-combobox-list"
          role="listbox"
          className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          {loading && items.length === 0 && (
            <li className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-500">
              Searching...
            </li>
          )}
          {!loading && items.length === 0 && query.trim() && (
            <li className="px-4 py-2 text-sm text-zinc-500 dark:text-zinc-500">
              No matches. Submit anyway to add &quot;{query.trim()}&quot;.
            </li>
          )}
          {items.map((item, idx) => {
            const active = idx === activeIndex;
            return (
              <li
                key={item.id}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(item);
                }}
                className={
                  "cursor-pointer px-4 py-2 text-sm " +
                  (active
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50"
                    : "text-zinc-700 dark:text-zinc-300")
                }
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {item.name_en ?? item.name_th}
                  </span>
                  {item.name_en && item.name_th && (
                    <span className="text-xs text-zinc-500 dark:text-zinc-500">
                      {item.name_th}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
