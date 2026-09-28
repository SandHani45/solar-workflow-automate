import {
  FEATURE_CATALOGUE,
  FEATURE_KEYS,
  isFeatureEnabled,
  type FeatureDefinition,
  type FeatureKey,
  type OrgFeatureMap,
} from '@solar/shared';
import { PlatformFeature } from './model';

/**
 * DB-backed feature catalogue (seeded from FEATURE_CATALOGUE). Cached in-process for a
 * few seconds because it is read on every authenticated request.
 */
const TTL_MS = 15_000;
let cache: { at: number; list: FeatureDefinition[] } | null = null;

export async function syncFeatureCatalogue(): Promise<void> {
  const ops = FEATURE_CATALOGUE.map((f) => ({
    updateOne: {
      filter: { key: f.key },
      // Only insert defaults; never overwrite what the super admin changed.
      update: { $setOnInsert: { key: f.key, name: f.name, description: f.description, category: f.category, defaultEnabled: f.defaultEnabled } },
      upsert: true,
    },
  }));
  await PlatformFeature.bulkWrite(ops);
  // Category is not editable by the super admin: keep it in sync with code.
  await Promise.all(FEATURE_CATALOGUE.map((f) => PlatformFeature.updateOne({ key: f.key }, { $set: { category: f.category } })));
  invalidateCatalogue();
}

export function invalidateCatalogue(): void {
  cache = null;
}

export async function getCatalogue(): Promise<FeatureDefinition[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.list;
  const docs = await PlatformFeature.find().lean();
  const byKey = new Map(docs.map((d) => [d.key, d]));
  // Order follows the code catalogue; fall back to code defaults for missing rows.
  const list: FeatureDefinition[] = FEATURE_CATALOGUE.map((f) => {
    const d = byKey.get(f.key);
    return d ? { key: f.key, name: d.name, description: d.description, category: f.category, defaultEnabled: d.defaultEnabled } : f;
  });
  cache = { at: Date.now(), list };
  return list;
}

/** Resolve every feature flag for an org (+ optional role restriction). */
export async function resolveOrgFeatures(orgFeatures: OrgFeatureMap | undefined, roleKey?: string): Promise<Record<FeatureKey, boolean>> {
  const catalogue = await getCatalogue();
  return Object.fromEntries(FEATURE_KEYS.map((k) => [k, isFeatureEnabled(k, orgFeatures, roleKey, catalogue)])) as Record<FeatureKey, boolean>;
}

/** Catalogue rows annotated with the org's state (used by /org/features and platform org detail). */
export async function orgFeatureRows(orgFeatures: OrgFeatureMap | undefined) {
  const catalogue = await getCatalogue();
  return catalogue.map((def) => {
    const o = orgFeatures?.[def.key];
    return {
      ...def,
      enabled: isFeatureEnabled(def.key, orgFeatures, undefined, catalogue),
      roles: o?.roles ?? [],
      lockedByPlatform: o?.lockedByPlatform ?? false,
    };
  });
}
