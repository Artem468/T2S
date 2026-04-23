export function pickNumericSeries(rows: Record<string, unknown>[]): number[] {
  if (!rows.length) return [];
  for (const key of Object.keys(rows[0])) {
    const nums = rows.map((r) => r[key]).map((v) => {
      if (typeof v === "number" && !Number.isNaN(v)) return v;
      if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
      return NaN;
    });
    if (nums.every((n) => !Number.isNaN(n))) return nums.slice(0, 8);
  }
  return rows.slice(0, 8).map((_, i) => (i + 1) * 12);
}

export type BarDatum = {
  label: string;
  value: number;
};

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function stringifyLabel(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function buildBarDataFromRows(rows: Record<string, unknown>[], limit = 40): BarDatum[] {
  if (!rows.length) return [];
  const keys = Object.keys(rows[0] ?? {});
  if (!keys.length) return [];

  const numericKey = keys.find((key) => rows.every((row) => parseNumber(row[key]) != null));
  if (!numericKey) {
    const labelKey = keys.find((key) => rows.some((row) => stringifyLabel(row[key]) !== ""));
    if (!labelKey) return [];
    const counts = new Map<string, number>();
    for (const row of rows) {
      const label = stringifyLabel(row[labelKey]) || "Без названия";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .slice(0, limit)
      .map(([label, value]) => ({ label, value }));
  }

  const labelKey = keys.find((key) => key !== numericKey && rows.some((row) => stringifyLabel(row[key]) !== ""));

  return rows.slice(0, limit).map((row, idx) => {
    const value = parseNumber(row[numericKey]) ?? 0;
    const label = labelKey ? stringifyLabel(row[labelKey]) : "";
    return {
      label: label || String(idx + 1),
      value,
    };
  });
}

export function normalizeBarPercents(values: number[]): number[] {
  if (!values.length) return [45, 62, 55, 78, 50];
  const m = Math.max(...values.map((v) => Math.abs(v)), 1e-9);
  return values.map((v) => Math.round((Math.abs(v) / m) * 100));
}

export function pieTwoParts(values: number[]): { a: number; b: number } {
  if (!values.length) return { a: 14, b: 3 };
  const a = Math.abs(Number(values[0]) || 0);
  const b = values.slice(1).reduce((s, v) => s + Math.abs(Number(v) || 0), 0) || 1;
  return { a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10 };
}

export function pieAngleFromRatio(a: number, b: number): number {
  const t = a + b;
  if (t <= 0) return 252;
  return Math.min(359, Math.round((a / t) * 360));
}
