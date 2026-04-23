from decimal import Decimal


def jsonable_row(mapping):
    out = {}
    for key, val in dict(mapping).items():
        if isinstance(val, Decimal):
            out[key] = float(val)
        elif hasattr(val, "isoformat"):
            out[key] = val.isoformat()
        elif isinstance(val, bytes):
            out[key] = val.decode("utf-8", errors="replace")
        else:
            out[key] = val
    return out