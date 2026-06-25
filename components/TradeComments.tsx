'use client';

import { useEffect, useState } from 'react';

type Comment = {
  id: string;
  body: string;
  author: string | null;
  created_at: string;
};

type Tally = { up: number; down: number };

export function TradeComments({ slug }: { slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [tally, setTally] = useState<Tally>({ up: 0, down: 0 });
  const [body, setBody] = useState('');
  const [author, setAuthor] = useState('');
  const [posting, setPosting] = useState(false);
  const [voting, setVoting] = useState(false);
  const [myVote, setMyVote] = useState<0 | 1 | -1>(0);

  // Stable per-browser voter id so a person's vote counts once (re-voting flips it). Created lazily
  // on the client; '' on the server. It's never rendered, so this can't cause a hydration mismatch.
  const [voter] = useState(() => {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem('tv_voter');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('tv_voter', id);
    }
    return id;
  });

  // Restore this browser's prior vote after mount. localStorage is client-only, so this can't be a
  // render-time initializer without risking a hydration mismatch on the button styling.
  useEffect(() => {
    const mv = Number(localStorage.getItem(`tv_vote_${slug}`));
    if (mv === 1 || mv === -1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount restore
      setMyVote(mv);
    }
  }, [slug]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/trade/${slug}/comments`).then((r) => r.json()),
      fetch(`/api/trade/${slug}/vote`).then((r) => r.json()),
    ])
      .then(([c, v]) => {
        if (!alive) return;
        setComments(c.comments ?? []);
        setTally({ up: v.up ?? 0, down: v.down ?? 0 });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  async function vote(value: 1 | -1) {
    if (voting) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/trade/${slug}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vote: value, voter }),
      });
      const v = await res.json();
      setTally({ up: v.up ?? 0, down: v.down ?? 0 });
      setMyVote(value);
      localStorage.setItem(`tv_vote_${slug}`, String(value));
    } catch {
      // no-op
    } finally {
      setVoting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/trade/${slug}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: text, author: author.trim() || undefined }),
      });
      const { comment } = await res.json();
      if (comment) {
        setComments((prev) => [comment, ...prev]);
        setBody('');
      }
    } catch {
      // no-op
    } finally {
      setPosting(false);
    }
  }

  const total = tally.up + tally.down;
  const pct = total ? Math.round((tally.up / total) * 100) : 0;

  return (
    <section className="panel rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--faint)]">Community</div>
      <h2 className="font-display text-xl font-bold uppercase tracking-tight text-[var(--text)]">
        Verdict
      </h2>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => vote(1)}
          disabled={voting}
          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold text-[var(--legal)] hover:brightness-110 disabled:opacity-50 ${myVote === 1 ? 'border-[var(--legal)] bg-[var(--legal)]/15' : 'border-[var(--border)] bg-[var(--surface-2)]'}`}
        >
          ▲ Approve <span className="num">{tally.up}</span>
        </button>
        <button
          type="button"
          onClick={() => vote(-1)}
          disabled={voting}
          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold text-[var(--illegal)] hover:brightness-110 disabled:opacity-50 ${myVote === -1 ? 'border-[var(--illegal)] bg-[var(--illegal)]/15' : 'border-[var(--border)] bg-[var(--surface-2)]'}`}
        >
          ▼ Reject <span className="num">{tally.down}</span>
        </button>
        {total > 0 && (
          <span className="num text-xs text-[var(--muted)]">{pct}% approve · {total} votes</span>
        )}
      </div>

      {total > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div className="h-full bg-[var(--legal)]" style={{ width: `${pct}%` }} />
        </div>
      )}

      <form onSubmit={submit} className="mt-4 space-y-2">
        <input
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Name (optional)"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Drop your take on this trade…"
          rows={3}
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={posting || !body.trim()}
          className="rounded-lg bg-[var(--accent)] px-4 py-2 font-display text-sm font-semibold uppercase tracking-wide text-[var(--bg)] hover:brightness-110 disabled:opacity-50"
        >
          {posting ? 'Posting…' : 'Post comment'}
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {comments.length === 0 && (
          <div className="text-sm text-[var(--faint)]">No comments yet. Be the first.</div>
        )}
        {comments.map((c) => (
          <div key={c.id} className="border-t border-[var(--border-soft)] pt-3">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-semibold text-[var(--text)]">
                {c.author || 'Anonymous'}
              </span>
              <span className="num text-[11px] text-[var(--faint)]">
                {new Date(c.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
