import { CheckConfigSchema, buildJsFilter, resolveRows } from './filter.js';
import type { CheckTypeEvaluator, EvalContext, EvalResult } from './types.js';

export const policyNotExistsEvaluator: CheckTypeEvaluator = {
  async evaluate(config, ctx: EvalContext): Promise<EvalResult> {
    const parsed = CheckConfigSchema.safeParse(config);
    if (!parsed.success) return { passed: false, detail: { error: 'Invalid check config', issues: parsed.error.issues } };

    const { table, filter } = parsed.data;

    const allRows = await resolveRows(table, ctx.linkId, ctx.db);
    const jsFilter = buildJsFilter(filter);
    const rows = jsFilter ? jsFilter(allRows) : allRows;
    return { passed: rows.length === 0, detail: { count: rows.length } };
  },
};
