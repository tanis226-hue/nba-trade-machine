import type { ApronTier, SeasonCap } from './types';

export function tierFor(salary: number, cap: SeasonCap): ApronTier {
  if (salary >= cap.secondApron) return 'second_apron';
  if (salary >= cap.firstApron) return 'first_apron';
  if (salary >= cap.taxLine) return 'over_tax';
  if (salary >= cap.salaryCap) return 'over_cap';
  return 'below_cap';
}
