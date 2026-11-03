import type { TradeAsset } from '@/lib/cba/types';
import type { DbDraftPick } from '@/lib/data/types';
import { parseProtection } from '@/lib/cba/protections';

function sourceUrl(source?: string): string | undefined {
  if (!source) return undefined;
  try {
    const url = new URL(source);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch { return undefined; }
}

/** Source terms are readable without a hover; missing terms never mean unprotected. */
export function PickDetails({ pick, asset }: { pick?: DbDraftPick; asset?: TradeAsset }) {
  const protection = parseProtection(asset ? asset.protections : pick?.protections);
  const originalTeam = asset?.originalTeam ?? pick?.original_team_id.toUpperCase();
  const rightsTeam = asset?.fromTeam ?? pick?.owning_team_id.toUpperCase();
  const isSwap = asset?.isSwap ?? pick?.is_swap;
  const isFrozen = asset?.isFrozen ?? pick?.is_frozen;
  const needsReview = pick?.needsReview || !!asset?.dataNotes?.length;
  const source = sourceUrl(asset?.source ?? pick?.source);
  const round = asset?.round ?? pick?.round;
  const summary = protection?.type === 'unprotected' ? 'Reported as unprotected.'
    : protection?.type === 'top' && protection.through != null ? `Protected through pick ${protection.through}.`
    : protection?.type === 'range' && protection.range ? `Reported range: ${protection.range[0]}–${protection.range[1]}. Read the full terms for conveyance.`
    : protection?.note ? 'Conditional terms supplied below.' : 'Protection terms not supplied. Do not assume this pick is unprotected.';

  return <div className="space-y-3 text-xs leading-relaxed text-[var(--muted)]">
    <dl className="space-y-1">
      <div className="flex justify-between gap-3"><dt>Original pick</dt><dd className="font-semibold text-[var(--text)]">{originalTeam ?? 'Not reported'}</dd></div>
      <div className="flex justify-between gap-3"><dt>Reported rights with</dt><dd className="font-semibold text-[var(--text)]">{rightsTeam ?? 'Not reported'}</dd></div>
      <div className="flex justify-between gap-3"><dt>Type</dt><dd>{isSwap ? 'Swap rights' : round === 1 ? 'First round' : round === 2 ? 'Second round' : 'Round not reported'}</dd></div>
    </dl>
    <p>{summary}</p>
    {isSwap && <p>Swap rights do not add an outright extra pick. The teams and favorable/unfavorable conditions in the source determine what can be exchanged.</p>}
    {isFrozen && <p className="font-semibold text-[var(--warn)]">Reported frozen pick. Its availability needs review under the applicable apron restrictions.</p>}
    {protection?.note && <div><strong className="text-[var(--text)]">Full reported terms</strong><p className="mt-1 whitespace-pre-wrap break-words">{protection.note}</p></div>}
    {protection?.years && <p>Reported protection years: {protection.years[0]}–{protection.years[1]}.</p>}
    {protection?.rolloverToSecond && <p>The source reports conversion to second-round pick(s). Check the full terms for the trigger and years.</p>}
    {protection?.type !== 'unprotected' && !protection?.rolloverToSecond && <p>Rollover or fallback: consult the full reported terms{protection?.note ? ' above' : ' at the source'}. This view does not establish an additional future obligation.</p>}
    {needsReview && <p className="font-semibold text-[var(--warn)]">Conditional rights need verification. Adding this pick does not confirm exclusive ownership or that every condition can be modeled.</p>}
    {!!asset?.dataNotes?.length && <ul className="list-disc space-y-1 pl-4">{asset.dataNotes.map((note,index) => <li key={index} className="break-words">{note}</li>)}</ul>}
    {source ? <a className="inline-flex min-h-11 items-center text-[var(--accent)] underline underline-offset-4" href={source} target="_blank" rel="noreferrer">Read draft-rights source</a> : <p>Source link not supplied for this saved entry.</p>}
  </div>;
}
