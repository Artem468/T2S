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
