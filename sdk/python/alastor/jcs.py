"""Pure-Python RFC 8785 JSON Canonicalization Scheme (JCS) + SHA-256 helper."""

from __future__ import annotations

import hashlib
import math
from typing import Any


def _escape_jcs_string(value: str) -> str:
    parts = ['"']
    for ch in value:
        code = ord(ch)
        if code == 0x08:
            parts.append("\\b")
        elif code == 0x09:
            parts.append("\\t")
        elif code == 0x0A:
            parts.append("\\n")
        elif code == 0x0C:
            parts.append("\\f")
        elif code == 0x0D:
            parts.append("\\r")
        elif code == 0x22:
            parts.append('\\"')
        elif code == 0x5C:
            parts.append("\\\\")
        elif code < 0x20:
            parts.append(f"\\u{code:04x}")
        else:
            parts.append(ch)
    parts.append('"')
    return "".join(parts)


def _utf16_sort_key(text: str) -> tuple[int, ...]:
    raw = text.encode("utf-16-be")
    return tuple((raw[i] << 8) | raw[i + 1] for i in range(0, len(raw), 2))


def canonicalize_jcs(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("RFC 8785 forbids NaN and Infinity in JSON")
        if value == 0.0:
            return "0"
        if value.is_integer() and abs(value) < 1e21:
            return str(int(value))
        return repr(value)
    if isinstance(value, str):
        return _escape_jcs_string(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonicalize_jcs(item) for item in value) + "]"
    if isinstance(value, dict):
        keys = sorted(value.keys(), key=_utf16_sort_key)
        entries = [f"{_escape_jcs_string(str(k))}:{canonicalize_jcs(value[k])}" for k in keys]
        return "{" + ",".join(entries) + "}"
    raise TypeError(f"Unsupported type for RFC 8785 canonicalization: {type(value).__name__}")


def sha256_jcs(payload: Any) -> tuple[str, str]:
    canonical = canonicalize_jcs(payload)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return canonical, digest
