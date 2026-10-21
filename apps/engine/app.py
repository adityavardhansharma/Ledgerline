"""Entry point for Vercel's Python runtime, which serves the ASGI `app` found here."""

from ledgerline_engine.api import app

__all__ = ["app"]
