/** Calendar-only dates are formatted in UTC so the displayed day never depends on the browser zone. */
export function isScenarioDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function formatScenarioDate(value: string): string {
  if (!isScenarioDate(value)) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`));
}

export function isDateInRosterSeason(value: string, season: string): boolean {
  const start = Number(season.slice(0, 4));
  return isScenarioDate(value) && Number.isInteger(start)
    && value >= `${start}-07-01` && value <= `${start + 1}-06-30`;
}
