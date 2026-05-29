import type { TenantServiceDb } from '@mspbyte/drizzle-catalog';

export type CheckInput = {
  siteId?: string;
  linkId?: string;
  db: TenantServiceDb;
};

export type Detection = {
  checkId: string;
  definitionId: string;
  linkId?: string;
  siteId?: string;
  entityType: string;
  entityRef: string;
  entityId: string;
  severity: number;
  detail: Record<string, unknown>;
};

export interface CheckEvaluator {
  readonly checkId: string;
  readonly definitionId: string;
  readonly definitionIds?: readonly string[];
  readonly sourceTables?: readonly string[];
  evaluate(input: CheckInput): Promise<Detection[]>;
}
