"""Thin, swappable network layer. One throttled GET of the single contracts page.

Sports Reference asks for a low request rate and no bulk redistribution; we fetch this
one page weekly plus on-demand refreshes. The delay runs BEFORE the request so repeated
calls stay polite. ToS confirmed in PRD section 7.
"""

import time

import httpx

USER_AGENT = "Mozilla/5.0 (compatible; NBATradeMachine/1.0; +https://nbatrademachine.app)"
_DELAY_SECONDS = 3.0


def fetch_html(url: str) -> str:
    time.sleep(_DELAY_SECONDS)
    resp = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=40.0, follow_redirects=True)
    resp.raise_for_status()
    return resp.text
