import type { MspDb } from '@mspbyte/drizzle';

export type EvalContext = {
  linkId: string;
  db: MspDb;
};

export type EvalResult = {
  passed: boolean;
  detail: Record<string, unknown>;
};

export interface CheckTypeEvaluator {
  evaluate(config: unknown, ctx: EvalContext): Promise<EvalResult>;
}
