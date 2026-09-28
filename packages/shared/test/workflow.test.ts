import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAGES, computeStageAvailability, validateWorkflow, projectProgress,
  isFeatureEnabled, computeQuotationTotals, splitProfit, DEFAULT_ROLES, ALL_PERMISSIONS,
} from '../src';

describe('default workflow', () => {
  it('is a valid DAG', () => {
    expect(validateWorkflow(DEFAULT_STAGES)).toEqual([]);
  });
  it('detects cycles and unknown deps', () => {
    const bad = [
      { ...DEFAULT_STAGES[0]!, key: 'a', dependsOn: ['b'] },
      { ...DEFAULT_STAGES[0]!, key: 'b', dependsOn: ['a', 'zzz'] },
    ];
    const errs = validateWorkflow(bad);
    expect(errs.some((e) => e.includes('cycle'))).toBe(true);
    expect(errs.some((e) => e.includes('zzz'))).toBe(true);
  });
  it('unlocks only root stages initially and parallel tracks after order gain', () => {
    const init = DEFAULT_STAGES.map((d) => ({ key: d.key, status: 'locked' as const }));
    const avail = computeStageAvailability(init, DEFAULT_STAGES);
    expect(avail.filter((s) => s.status === 'pending').map((s) => s.key)).toEqual(['quotation_sent']);

    const afterSales = avail.map((s) =>
      ['quotation_sent', 'site_survey', 'final_quotation'].includes(s.key) ? { ...s, status: 'completed' as const } : s,
    );
    const next = computeStageAvailability(afterSales, DEFAULT_STAGES).filter((s) => s.status === 'pending').map((s) => s.key);
    expect(next.sort()).toEqual(['advance_payment', 'boq_preparation', 'documents_collection']);
    expect(projectProgress(afterSales)).toBe(Math.round((3 / DEFAULT_STAGES.length) * 100));
  });
});

describe('features', () => {
  it('respects defaults, overrides and role restrictions', () => {
    expect(isFeatureEnabled('inventory', undefined)).toBe(true);
    expect(isFeatureEnabled('amc_contracts', undefined)).toBe(false);
    expect(isFeatureEnabled('inventory', { inventory: { enabled: false } })).toBe(false);
    const f = { finance_dashboard: { enabled: true, roles: ['accounts'] } };
    expect(isFeatureEnabled('finance_dashboard', f, 'sales')).toBe(false);
    expect(isFeatureEnabled('finance_dashboard', f, 'accounts')).toBe(true);
    expect(isFeatureEnabled('finance_dashboard', f, 'owner')).toBe(true);
  });
});

describe('finance', () => {
  it('computes quotation totals with GST and discount', () => {
    const t = computeQuotationTotals([{ description: 'x', quantity: 2, unitPrice: 100, gstPercent: 12 }], 24);
    expect(t).toEqual({ subtotal: 200, gstTotal: 24, discount: 24, grandTotal: 200 });
  });
  it('splits profit across partners net of advances', () => {
    const rows = splitProfit(90000, [
      { name: 'A', sharePercent: 50 }, { name: 'B', sharePercent: 30 }, { name: 'C', sharePercent: 20 },
    ], { A: 5000 });
    expect(rows.map((r) => r.netPayable)).toEqual([40000, 27000, 18000]);
  });
});

describe('roles', () => {
  it('owner has every permission and all role permissions are known', () => {
    expect(DEFAULT_ROLES.find((r) => r.key === 'owner')!.permissions).toEqual(ALL_PERMISSIONS);
    for (const r of DEFAULT_ROLES) for (const p of r.permissions) expect(ALL_PERMISSIONS).toContain(p);
  });
});
