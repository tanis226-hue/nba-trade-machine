import type { ApronTier, SeasonCap } from './types';

export function tierFor(salary: number, cap: SeasonCap): ApronTier {
  if (salary >= cap.secondApron) return 'second_apron';
  if (salary >= cap.firstApron) return 'first_apron';
  if (salary >= cap.taxLine) return 'over_tax';
  if (salary >= cap.salaryCap) return 'over_cap';
  return 'below_cap';
}

/** Apron restrictions use apron salary; cap/tax status keeps its own basis. */
export function tierForTeam(capSalary:number,apronSalary:number,cap:SeasonCap):ApronTier {
  if(apronSalary>=cap.secondApron) return 'second_apron';
  if(apronSalary>=cap.firstApron) return 'first_apron';
  if(capSalary>=cap.taxLine) return 'over_tax';
  return capSalary>=cap.salaryCap?'over_cap':'below_cap';
}
