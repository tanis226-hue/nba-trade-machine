'use client';

import { useId, useState } from 'react';
import { formatScenarioDate, isDateInRosterSeason, isScenarioDate } from '@/lib/trades/scenario';

export function ScenarioControls({ season, date, onDateChange }: {
  season: string;
  date: string;
  onDateChange: (date: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(date);
  const [error, setError] = useState('');
  return <div className="scenario-context">
    <p><strong>{season} rosters</strong><span>Checking <time dateTime={date}>{formatScenarioDate(date)}</time></span></p>
    {!isDateInRosterSeason(date, season) && <p className="scenario-warning">This date is outside the {season} roster year. Salaries and rosters still use {season}; a date change does not model a new season.</p>}
    <details>
      <summary>Change trade date</summary>
      <form onSubmit={event => {
        event.preventDefault();
        if (!isScenarioDate(draft)) { setError('Enter a complete, valid date. Your current check date is unchanged.'); return; }
        setError('');
        onDateChange(draft);
      }}>
        <label htmlFor={id}>Trade date</label>
        <div className="scenario-date-input"><input id={id} name="trade-date" type="date" required value={draft} onChange={event => { setDraft(event.target.value); setError(''); }} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} aria-invalid={error ? true : undefined}/><button className="ui-button" type="submit" disabled={draft === date}>Update date</button></div>
        <p id={`${id}-help`}>Recheck timing restrictions with the same roster, salaries, and assumptions.</p>
        {error && <p id={`${id}-error`} role="alert">{error}</p>}
      </form>
    </details>
  </div>;
}
