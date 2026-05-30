import { Worker } from 'bullmq';
import { QUEUES } from '@mspbyte/shared';
import type { ComplianceJobData } from '@mspbyte/shared';
import { getTenantServiceDbByOrgId, type TenantServiceDb } from '@mspbyte/drizzle-catalog';
import { complianceFrameworkChecks, complianceResults } from '@mspbyte/drizzle';
import { eq, and } from 'drizzle-orm';
import { checkTypeRegistry } from '../evaluators/registry.js';
import { scoreFramework } from '../scoring.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';
import { env } from '../env.js';

export function createComplianceWorker(redis: Redis) {
  return new Worker<ComplianceJobData>(
    QUEUES.COMPLIANCE,
    async (job) => {
      const { siteId, orgId, frameworkId, linkId } = job.data;

      let db: TenantServiceDb;
      try {
        ({ db } = await getTenantServiceDbByOrgId(orgId, env.ENCRYPTION_KEY));
      } catch (err) {
        logger.error({ orgId, err }, 'Org not found — skipping compliance job');
        return;
      }

      const checks = await db
        .select()
        .from(complianceFrameworkChecks)
        .where(
          and(
            eq(complianceFrameworkChecks.frameworkId, frameworkId),
            eq(complianceFrameworkChecks.enabled, true)
          )
        );

      if (checks.length === 0) {
        logger.info({ orgId, frameworkId }, 'No enabled checks for framework');
        return;
      }

      logger.info({ orgId, frameworkId, siteId, checks: checks.length }, 'Compliance job started');

      const results: Array<{ status: 'pass' | 'fail' | 'suppressed' | 'error' }> = [];

      for (const check of checks) {
        let status: 'pass' | 'fail' | 'error' = 'error';
        let detail: Record<string, unknown> = {};

        const evaluator = checkTypeRegistry.get(check.checkTypeId ?? '');

        if (evaluator && check.checkConfig && linkId) {
          try {
            const result = await evaluator.evaluate(check.checkConfig, { linkId, db });
            status = result.passed ? 'pass' : 'fail';
            detail = result.detail;
          } catch (err) {
            logger.warn(
              { checkId: check.id, checkTypeId: check.checkTypeId, err },
              'Check-type evaluator failed'
            );
            detail = { error: err instanceof Error ? err.message : String(err) };
          }
        } else if (!evaluator) {
          detail = { error: `No evaluator registered for checkTypeId: ${check.checkTypeId}` };
        } else {
          detail = { error: 'linkId required for evaluation' };
        }

        try {
          await db
            .insert(complianceResults)
            .values({
              frameworkCheckId: check.id,
              siteId: siteId ?? null,
              linkId: linkId ?? null,
              status,
              detail,
              evaluatedAt: new Date()
            })
            .onConflictDoUpdate({
              target: [
                complianceResults.frameworkCheckId,
                complianceResults.siteId,
                complianceResults.linkId
              ],
              set: { status, detail, evaluatedAt: new Date() }
            });
        } catch (err) {
          logger.error(
            { linkId, siteId, frameworkId, checkTypeId: check.checkTypeId, err },
            'Compliance check failed'
          );
          return;
        }
        results.push({ status });
        logger.info(
          { frameworkId, checkTypeId: check.checkTypeId, status },
          'Compliance check evaluated'
        );
      }

      const score = scoreFramework(results);
      logger.info(
        { orgId, frameworkId, siteId, score, total: results.length },
        'Compliance job complete'
      );
    },
    { connection: redis, concurrency: 3 }
  );
}
