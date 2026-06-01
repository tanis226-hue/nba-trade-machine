"""Thin, swappable network layer. Confirm the source's ToS before enabling (spec section 11)."""

import time

import httpx

USER_AGENT = "Mozilla/5.0 (compatible; NBATradeMachine/1.0; +https://example.com)"
_DELAY_SECONDS = 1.5  # be polite


def fetch_team_html(url: str) -> str:
    resp = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=30.0, follow_redirects=True)
    resp.raise_for_status()
    time.sleep(_DELAY_SECONDS)
    return resp.text
