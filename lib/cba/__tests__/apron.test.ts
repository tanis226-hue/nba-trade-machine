import { describe, it, expect } from 'vitest';
import { restrictionsFor } from '@/lib/cba/apron';
import type { ApronRules } from '@/lib/cba/types';

const rules: ApronRules = {
  firstApron: { canAggregate: true, maxTakebackPct: 1.0, blockedTools: ['sign_and_trade', 'bae', 'non_taxpayer_mle', 'prior_year_tpe'] },
  secondApron: { canAggregate: false, maxTakebackPct: 1.0, blockedTools: ['mle', 'aggregation', 'cash_out', 'frozen_pick'] },
};

describe('restrictionsFor', () => {
  it('below apron: aggregate allowed, no blocked tools', () =>
    expect(restrictionsFor('over_cap', rules)).toEqual({ canAggregate: true, maxTakebackPct: Infinity, blockedTools: [] }));
  it('first apron', () => expect(restrictionsFor('first_apron', rules)).toEqual(rules.firstApron));
  it('second apron: no aggregation', () => expect(restrictionsFor('second_apron', rules)).toEqual(rules.secondApron));
});
