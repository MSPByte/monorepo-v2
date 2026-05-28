import type { MspServiceDb } from '@mspbyte/drizzle';

export type EvalContext = {
  linkId: string;
  db: MspServiceDb;
};

export type EvalResult = {
  passed: boolean;
  detail: Record<string, unknown>;
};

export interface CheckTypeEvaluator {
  evaluate(config: unknown, ctx: EvalContext): Promise<EvalResult>;
}
