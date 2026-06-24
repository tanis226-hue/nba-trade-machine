'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useTradeStore } from '@/lib/store/tradeStore';
import {
  SEASON_2026_27, MATCHING_2026_27, CASH_LIMIT_2026_27, LEAGUE_CALENDAR_2026_27,
  SEASON_2025_26, MATCHING_2025_26, CASH_LIMIT_2025_26, LEAGUE_CALENDAR_2025_26,
} from '@/lib/cba/constants';

const BY_SEASON = {
  '2026-27': { cap: SEASON_2026_27, matching: MATCHING_2026_27, cash: CASH_LIMIT_2026_27, cal: LEAGUE_CALENDAR_2026_27, projected: true },
  '2025-26': { cap: SEASON_2025_26, matching: MATCHING_2025_26, cash: CASH_LIMIT_2025_26, cal: LEAGUE_CALENDAR_2025_26, projected: false },
} as const;

const fm = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : `$${Math.round(n / 1000)}K`;
const date = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Rule({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-[13px] font-bold uppercase tracking-wide text-[var(--text)]">{title}</h3>
      <div className="mt-1 space-y-1 text-[12px] leading-relaxed text-[var(--muted)]">{children}</div>
    </section>
  );
}
const Hi = ({ children }: { children: ReactNode }) => <span className="num font-semibold text-[var(--text)]">{children}</span>;

export function TradeRulesButton({ className = '' }: { className?: string }) {
  const season = useTradeStore((s) => s.season);
  const [open, setOpen] = useState(false);
  const cfg = BY_SEASON[season as keyof typeof BY_SEASON] ?? BY_SEASON['2026-27'];
  const { cap, matching, cash, cal, projected } = cfg;
  const [b0, b1] = matching.belowApron;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="How NBA trade rules work"
        className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${className || 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)]'}`}
      >
        ⓘ Trade rules
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="NBA trade rules"
            onClick={(e) => e.stopPropagation()}
            className="panel ticked relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl"
          >
            <div className="flex items-center justify-between bg-[var(--accent)] px-4 py-2.5">
              <span className="font-display text-base font-bold uppercase tracking-[0.08em] text-[var(--ink)]">
                How trade rules work · {season}
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-[var(--ink)]/80 transition hover:text-[var(--ink)]">✕</button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {projected && (
                <p className="rounded-md border border-[var(--warn)]/30 bg-[var(--warn)]/10 px-2.5 py-1.5 text-[11px] text-[var(--muted)]">
                  {season} cap landmarks are projected. The CBA <em>structure</em> below is fixed; only the dollar thresholds move when the NBA sets the official cap.
                </p>
              )}

              <Rule title="The four salary lines">
                <p>Every rule keys off where a team sits against these {season} lines:</p>
                <ul className="ml-3 list-disc space-y-0.5">
                  <li><Hi>Salary cap {fm(cap.salaryCap)}</Hi> - a soft cap. Teams go over it using exceptions, so most contenders are above it.</li>
                  <li><Hi>Luxury tax {fm(cap.taxLine)}</Hi> - go over and you pay an escalating penalty on every dollar above the line.</li>
                  <li><Hi>First apron {fm(cap.firstApron)}</Hi> - a harder ceiling: you lose tools (see below) and your trade take-back drops to 1:1.</li>
                  <li><Hi>Second apron {fm(cap.secondApron)}</Hi> - the strictest tier: no combining salaries, no trade exceptions, no cash, and a frozen future pick.</li>
                </ul>
              </Rule>

              <Rule title="Salary matching (the core rule)">
                <p>An over-the-cap team must send out roughly as much salary as it takes back. How much you can take back depends on the salary you send:</p>
                <ul className="ml-3 list-disc space-y-0.5">
                  <li>Send <Hi>up to {fm(b0.upTo)}</Hi> → take back up to <Hi>{Math.round(b0.pct * 100)}% + {fm(b0.add)}</Hi>.</li>
                  <li>Send <Hi>{fm(b0.upTo)}–{fm(b1.upTo)}</Hi> → take back up to <Hi>outgoing + {fm(b1.add)}</Hi>.</li>
                  <li>Send <Hi>over {fm(b1.upTo)}</Hi> → take back up to <Hi>125% + {fm(matching.belowApron[2].add)}</Hi>.</li>
                  <li>Any team <Hi>over the first apron</Hi> is capped at <Hi>100%</Hi> (1-for-1) no matter the size.</li>
                </ul>
                <p>Teams <Hi>under the cap</Hi> don&rsquo;t match at all - they can absorb salary straight into their cap room.</p>
              </Rule>

              <Rule title="Aggregation">
                <p>Combining two or more outgoing players&rsquo; salaries to match one bigger incoming salary. Allowed for most teams, but a <Hi>second-apron team cannot aggregate</Hi> - it can only swap salaries roughly one-for-one.</p>
              </Rule>

              <Rule title="Hard cap">
                <p>Certain moves (acquiring a player by sign-and-trade, using the bigger mid-level exception or the bi-annual exception) <Hi>hard-cap</Hi> your team at the <Hi>first apron ({fm(cap.firstApron)})</Hi> for the rest of the season. Once hard-capped, a trade that pushes you over that line is illegal even if it otherwise matches.</p>
              </Rule>

              <Rule title="Trade exceptions (TPE)">
                <p>A <Hi>simultaneous</Hi> trade settles in and out at once and uses the matching brackets above. A <Hi>non-simultaneous</Hi> trade takes back less than it sends and the leftover room becomes a <Hi>traded-player exception</Hi> - a credit good for <Hi>12 months</Hi> to absorb one future player. Second-apron teams cannot create or use a TPE.</p>
              </Rule>

              <Rule title="Cash in trades">
                <p>A team can send or receive at most <Hi>{fm(cash)}</Hi> in cash per season, and the send and receive limits are <Hi>separate</Hi>. Second-apron teams cannot send or receive cash at all. Cash never counts toward salary matching.</p>
              </Rule>

              <Rule title="Draft picks">
                <ul className="ml-3 list-disc space-y-0.5">
                  <li><Hi>Stepien rule:</Hi> a team can&rsquo;t leave itself without a first-round pick in two consecutive future years.</li>
                  <li><Hi>Seven-year window:</Hi> you can only trade picks up to seven drafts out.</li>
                  <li><Hi>Frozen pick:</Hi> a second-apron team&rsquo;s first-rounder seven years out is frozen and can&rsquo;t be moved.</li>
                  <li><Hi>Swaps &amp; protections</Hi> are real, distinct assets - hover a pick chip to see its protection wording.</li>
                </ul>
              </Rule>

              <Rule title="Timing rules (when a player can&rsquo;t move yet)">
                <p>After certain events a player is locked for a window. The engine checks these against the trade date:</p>
                <ul className="ml-3 list-disc space-y-0.5">
                  <li><Hi>After signing:</Hi> a just-signed free agent generally can&rsquo;t be traded for <Hi>3 months</Hi> (or until <Hi>{date(cal.decGuaranteeEligible)}</Hi>, whichever is later).</li>
                  <li><Hi>After a trade (aggregation):</Hi> a just-acquired player can&rsquo;t be combined with another player&rsquo;s salary for <Hi>2 months</Hi>.</li>
                  <li><Hi>After a trade (no-trade-back):</Hi> a player can&rsquo;t be dealt <Hi>back to the team that traded him for 1 year</Hi>.</li>
                  <li><Hi>After an extension:</Hi> a recently-extended player is trade-frozen for <Hi>6 months</Hi> (a designated-veteran supermax: a full year).</li>
                  <li><Hi>Trade deadline:</Hi> in-season trades stop at the deadline (<Hi>{date(cal.tradeDeadline)}</Hi> this year).</li>
                  <li><Hi>Consent:</Hi> a <Hi>no-trade clause</Hi> (or a one-year Bird re-signing) lets the player veto the deal.</li>
                </ul>
                <p>These are evaluated as of the <Hi>Trade date</Hi> in the toolbar (today by default), so the engine can tell you a deal is &ldquo;illegal now, legal on &lt;date&gt;.&rdquo;</p>
              </Rule>

              <Rule title="Reading the verdict">
                <p>The validation panel flags each finding by severity:</p>
                <ul className="ml-3 list-disc space-y-0.5">
                  <li><span className="font-semibold" style={{ color: 'var(--illegal)' }}>Illegal</span> - a hard block; the trade can&rsquo;t be made as built.</li>
                  <li><span className="font-semibold" style={{ color: 'var(--warn)' }}>Warning</span> - legal, but it costs you (tax bill, hard cap, repeater).</li>
                  <li><span className="font-semibold" style={{ color: 'var(--info)' }}>Conditional</span> - legal only on or after a certain date.</li>
                  <li><span className="font-semibold text-[var(--muted)]">Note</span> - informational (a TPE created, consent required).</li>
                </ul>
                <p>Each finding cites the rule it comes from, and &ldquo;Make this trade legal&rdquo; suggests the smallest fix.</p>
              </Rule>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
