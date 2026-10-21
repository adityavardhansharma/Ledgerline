"""Request signing between Convex and the engine.

Convex signs ``{timestamp}.{METHOD}.{path}.{body}`` with HMAC-SHA256 and the shared secret and sends
``X-LL-Timestamp`` and ``X-LL-Signature`` (hex). The engine rejects unsigned, tampered or replayed requests.
"""

from __future__ import annotations

import hashlib
import hmac
import time


def sign(secret: str, timestamp: int, method: str, path: str, body: bytes) -> str:
    message = f"{timestamp}.{method.upper()}.{path}.".encode() + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def verify(
    secret: str,
    timestamp_header: str | None,
    signature_header: str | None,
    method: str,
    path: str,
    body: bytes,
    window_seconds: int = 300,
    now: float | None = None,
) -> bool:
    if not secret or not timestamp_header or not signature_header:
        return False
    try:
        timestamp = int(timestamp_header)
    except ValueError:
        return False
    current = time.time() if now is None else now
    if abs(current - timestamp) > window_seconds:
        return False
    expected = sign(secret, timestamp, method, path, body)
    return hmac.compare_digest(expected, signature_header)
