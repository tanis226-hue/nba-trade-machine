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
  const [error,setError]=useState<string|null>(null);

  // Stable per-browser voter id so a person's vote counts once (re-voting flips it). Created lazily
  // on the client; '' on the server. It's never rendered, so this can't cause a hydration mismatch.
  const [voter] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
    let id = localStorage.getItem('tv_voter');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('tv_voter', id);
    }
    return id;
    } catch {return crypto.randomUUID();}
  });

  // Restore this browser's prior vote after mount. localStorage is client-only, so this can't be a
  // render-time initializer without risking a hydration mismatch on the button styling.
  useEffect(() => {
    let mv=0;
    try {mv=Number(localStorage.getItem(`tv_vote_${slug}`));} catch {}
    if (mv === 1 || mv === -1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-mount restore
      setMyVote(mv);
    }
  }, [slug]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/trade/${slug}/comments`).then((r) => {if(!r.ok) throw new Error('Community is temporarily unavailable');return r.json();}),
      fetch(`/api/trade/${slug}/vote`).then((r) => {if(!r.ok) throw new Error('Community is temporarily unavailable');return r.json();}),
    ])
      .then(([c, v]) => {
        if (!alive) return;
        setComments(c.comments ?? []);
        setTally({ up: v.up ?? 0, down: v.down ?? 0 });
      })
      .catch(()=>{if(alive) setError('Community is temporarily unavailable');});
    return () => {
      alive = false;
    };
  }, [slug]);

  async function vote(value: 1 | -1) {
    if (voting) return;
    setVoting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trade/${slug}/vote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vote: value, voter }),
      });
      const v = await res.json();
      if(!res.ok) throw new Error(v.error??'Could not record your vote');
      setTally({ up: v.up ?? 0, down: v.down ?? 0 });
      setMyVote(value);
      try {localStorage.setItem(`tv_vote_${slug}`, String(value));} catch {}
    } catch(error) {
      setError(error instanceof Error?error.message:'Could not record your vote');
    } finally {
      setVoting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/trade/${slug}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: text, author: author.trim() || undefined }),
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error??'Could not post this comment');
      const {comment}=data;
      if (comment) {
        setComments((prev) => [comment, ...prev]);
        setBody('');
      }
    } catch(error) {
      setError(error instanceof Error?error.message:'Could not post this comment');
    } finally {
      setPosting(false);
    }
  }

  const total = tally.up + tally.down;
  const pct = total ? Math.round((tally.up / total) * 100) : 0;

  return (
    <section className="panel community-panel rounded-xl p-5">
      <p className="text-sm text-[var(--muted)]">Talk it over</p>
      <h2 className="mt-1 text-xl font-bold text-[var(--text)]">
        Would you make this trade?
      </h2>
      {error && <p role="alert" className="mt-2 text-xs text-[var(--illegal)]">{error}</p>}

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
          maxLength={80}
          aria-label="Name (optional)"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Name (optional)"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--faint)] focus:border-[var(--accent)] focus:outline-none"
        />
        <textarea
          maxLength={1000}
          aria-label="Comment"
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
