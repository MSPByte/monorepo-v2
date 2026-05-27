import { CheckConfigSchema, buildJsFilter, evalFieldOp, getNestedValue, resolveRows } from './filter.js';
import type { CheckTypeEvaluator, EvalContext, EvalResult } from './types.js';

export const policyExistsEvaluator: CheckTypeEvaluator = {
  async evaluate(config, ctx: EvalContext): Promise<EvalResult> {
    const parsed = CheckConfigSchema.safeParse(config);
    if (!parsed.success) return { passed: false, detail: { error: 'Invalid check config', issues: parsed.error.issues } };

    const { table, filter, threshold = 1 } = parsed.data;

    const allRows = await resolveRows(table, ctx.linkId, ctx.db);
    const jsFilter = buildJsFilter(filter);
    const rows = jsFilter ? jsFilter(allRows) : allRows;
    const passed = rows.length >= threshold;

    if (!passed && filter?.conditions.length) {
      const failedConditions = filter.conditions.map((cond) => ({
        field: cond.field,
        op: cond.op,
        value: cond.value,
        matchedCount: allRows.filter((r) => evalFieldOp(getNestedValue(r, cond.field), cond.op, cond.value)).length,
      }));
      return { passed, detail: { count: rows.length, threshold, failedConditions } };
    }
    return { passed, detail: { count: rows.length, threshold } };
  },
};
