def _numeric_column(rows: list[dict]) -> tuple[str | None, list[float]]:
    if not rows:
        return None, []
    keys = list(rows[0].keys())
    for key in keys:
        out: list[float] = []
        ok = True
        for row in rows:
            v = row.get(key)
            if v is None:
                ok = False
                break
            if isinstance(v, bool):
                ok = False
                break
            if isinstance(v, (int, float)):
                out.append(float(v))
                continue
            if isinstance(v, str) and v.strip() != "":
                try:
                    out.append(float(v.replace(",", ".")))
                except ValueError:
                    ok = False
                    break
                continue
            ok = False
            break
        if ok and out:
            return key, out
    return None, []


def build_chart_json(rows: list[dict], max_bars: int = 12) -> dict:
    _, nums = _numeric_column(rows)
    if not nums:
        return {"bars": [], "pie": {"segments": []}}

    slice_n = nums[:max_bars]
    bars = [{"label": str(i + 1), "value": round(v, 4)} for i, v in enumerate(slice_n)]

    a = abs(float(slice_n[0]))
    b = sum(abs(float(x)) for x in slice_n[1:]) if len(slice_n) > 1 else max(a, 1.0)
    pie_segments = [
        {"label": "1", "value": round(a, 4)},
        {"label": "остальные", "value": round(b, 4)},
    ]
    return {"bars": bars, "pie": {"segments": pie_segments}}
