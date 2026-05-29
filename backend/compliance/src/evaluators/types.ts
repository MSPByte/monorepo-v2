import type { TenantServiceDb } from '@mspbyte/drizzle-catalog';

export type EvalContext = {
  linkId: string;
  db: TenantServiceDb;
};

export type EvalResult = {
  passed: boolean;
  detail: Record<string, unknown>;
};

export interface CheckTypeEvaluator {
  evaluate(config: unknown, ctx: EvalContext): Promise<EvalResult>;
}
