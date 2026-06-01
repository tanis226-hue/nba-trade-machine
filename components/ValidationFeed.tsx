'use client';
import type { TradeValidation } from '@/lib/cba/types';

export function ValidationFeed({ validation }: { validation: TradeValidation }) {
  if (validation.valid) {
    return <div className="rounded-lg bg-green-50 p-3 text-sm font-medium text-green-800">✓ Trade is legal under the CBA.</div>;
  }
  return (
    <div className="space-y-1 rounded-lg bg-red-50 p-3 text-sm text-red-800">
      {validation.errors.map((e, i) => (
        <div key={i}>
          <span className="font-semibold">Trade Denied:</span> {e.message}
        </div>
      ))}
    </div>
  );
}
