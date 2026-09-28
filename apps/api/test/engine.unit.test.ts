import { describe, expect, it } from 'vitest';
import { DEFAULT_STAGES, type StageDefinition } from '@solar/shared';
import { applyDisabledStages, derivedFields, initialStageStates, recomputeStages, stageDisabledCheck } from '../src/modules/projects/workflow.service';
import { pageParams } from '../src/lib/pagination';
import { toCsv } from '../src/lib/csv';
import { serialize } from '../src/lib/serialize';
import { Types } from '../src/lib/mongoose';

const defs = DEFAULT_STAGES;
const status = (stages: { key: string; status: string }[], key: string) => stages.find((s) => s.key === key)!.status;

describe('engine helpers (pure)', () => {
  it('initial states: only the root is pending and gets a dueAt from slaDays', () => {
    const stages = initialStageStates(defs);
    const now = new Date('2026-01-01T00:00:00Z');
    const unlocked = recomputeStages(stages, defs, now);
    expect(unlocked).toEqual(['quotation_sent']);
    expect(stages[0]!.dueAt!.toISOString()).toBe('2026-01-03T00:00:00.000Z');
    expect(stages.filter((s) => s.status === 'locked')).toHaveLength(defs.length - 1);
  });

  it('parallel unlock after order gain and join waits for every dependency', () => {
    const stages = initialStageStates(defs);
    for (const k of ['quotation_sent', 'site_survey', 'final_quotation']) stages.find((s) => s.key === k)!.status = 'completed';
    const unlocked = recomputeStages(stages, defs);
    expect(unlocked.sort()).toEqual(['advance_payment', 'boq_preparation', 'documents_collection']);
    stages.find((s) => s.key === 'boq_preparation')!.status = 'completed';
    recomputeStages(stages, defs);
    expect(status(stages, 'material_check')).toBe('locked'); // needs advance_payment too
    stages.find((s) => s.key === 'advance_payment')!.status = 'completed';
    const next = recomputeStages(stages, defs);
    expect(next.sort()).toEqual(['engineer_allocation', 'material_check']);
    expect(derivedFields(stages, defs).currentPhase).toBe('documentation');
  });

  it('disabled features and disabled stages are skipped and restored', () => {
    const custom: StageDefinition[] = defs.map((d) => (d.key === 'review_request' ? { ...d, enabled: false } : d));
    const stages = initialStageStates(custom);
    const check = stageDisabledCheck({ site_survey: { enabled: false } }, [{ key: 'site_survey', defaultEnabled: true } as never]);
    expect(applyDisabledStages(stages, custom, check)).toBe(true);
    expect(status(stages, 'site_survey')).toBe('skipped');
    expect(status(stages, 'review_request')).toBe('skipped');
    stages.find((s) => s.key === 'quotation_sent')!.status = 'completed';
    recomputeStages(stages, custom);
    expect(status(stages, 'final_quotation')).toBe('pending');
    // re-enable the feature → restored to locked → availability recomputed
    const on = stageDisabledCheck({ site_survey: { enabled: true } }, [{ key: 'site_survey', defaultEnabled: true } as never]);
    applyDisabledStages(stages, custom, on);
    recomputeStages(stages, custom);
    expect(status(stages, 'site_survey')).toBe('pending');
    expect(status(stages, 'review_request')).toBe('skipped');
  });

  it('progress counts completed + skipped', () => {
    const stages = initialStageStates(defs);
    stages.forEach((s) => (s.status = 'completed'));
    expect(derivedFields(stages, defs)).toEqual({ currentPhase: 'closure', progress: 100 });
  });
});

describe('lib helpers', () => {
  it('pageParams clamps and whitelists sort', () => {
    expect(pageParams({ page: '0', limit: '500', sort: '-passwordHash' })).toMatchObject({ page: 1, limit: 100, skip: 0, sort: { createdAt: -1 } });
    expect(pageParams({ page: '3', limit: '10', sort: 'name' }, ['name'])).toMatchObject({ page: 3, limit: 10, skip: 20, sort: { name: 1 } });
  });

  it('csv escapes quotes, commas and formula injection', () => {
    const csv = toCsv([{ a: 'x,"y"', b: '=SUM(A1)', c: -5 }], [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
      { header: 'C', value: (r) => r.c },
    ]);
    expect(csv).toContain('"x,""y"""');
    expect(csv).toContain("'=SUM(A1)");
    expect(csv).toContain(',-5');
  });

  it('serialize maps _id → id and strips secrets', () => {
    const id = new Types.ObjectId();
    const out = serialize<any>({ _id: id, __v: 1, passwordHash: 'x', sessions: [], nested: { _id: id, ref: id }, list: [{ _id: id }] });
    expect(out).toEqual({ id: String(id), nested: { id: String(id), ref: String(id) }, list: [{ id: String(id) }] });
  });
});
