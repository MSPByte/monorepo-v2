import { CheckConfigSchema, buildJsFilter, getNestedValue, resolveRows } from './filter.js';
import type { CheckTypeEvaluator, EvalContext, EvalResult } from './types.js';

export const fieldNotEqualsEvaluator: CheckTypeEvaluator = {
  async evaluate(config, ctx: EvalContext): Promise<EvalResult> {
    const parsed = CheckConfigSchema.safeParse(config);
    if (!parsed.success) return { passed: false, detail: { error: 'Invalid check config', issues: parsed.error.issues } };

    const { table, filter, field, value } = parsed.data;
    if (!field) return { passed: false, detail: { error: 'check_config.field is required' } };

    const allRows = await resolveRows(table, ctx.linkId, ctx.db);
    const jsFilter = buildJsFilter(filter);
    const rows = jsFilter ? jsFilter(allRows) : allRows;
    const row = rows[0] ?? null;
    if (!row) return { passed: false, detail: { reason: 'no row found' } };

    const actual = getNestedValue(row, field);
    return { passed: actual != value, detail: { field, unexpected: value, actual } };
  },
};
