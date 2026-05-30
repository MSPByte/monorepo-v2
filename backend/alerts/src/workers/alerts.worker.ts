import { Queue, Worker } from 'bullmq';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import { QUEUES, MAX_CONSECUTIVE_FAILURES, getFacetTableMap } from '@mspbyte/shared';
import type { AlertsJobData, ComplianceJobData, ProviderFacet } from '@mspbyte/shared';
import { getTenantServiceDbByOrgId } from '@mspbyte/drizzle-catalog';
import {
  complianceAssignments,
  complianceFrameworks,
  complianceFrameworkChecks,
  integrationLinks,
  syncContext,
  syncRuns
} from '@mspbyte/drizzle';
import { startStage, completeStage, failStage } from '@mspbyte/shared';
import { checkRegistry } from '../checks/registry.js';
import { resolveMissingAlerts, upsertAlert } from '../upsert.js';
import { logger } from '../logger.js';
import type { Redis } from 'ioredis';
import { env } from '../env.js';

const TABLE_ALIASES: Record<string, string> = {
  m365Identities: 'm365_identities',
  m365Groups: 'm365_groups',
  m365Policies: 'm365_policies',
  m365Licenses: 'm365_licenses',
  m365ExchangeConfigs: 'm365_exchange_configs',
  m365AuthMethods: 'm365_auth_methods',
  m365Devices: 'm365_devices',
  m365OAuthGrants: 'm365_oauth_grants',
  m365DomainConfig: 'm365_domain_config',
  m365TeamsConfig: 'm365_teams_config',
  m365RiskyUsers: 'm365_risky_users',
  m365MailboxForwarding: 'm365_mailbox_forwarding',
  m365InboxRules: 'm365_inbox_rules',
  sophosEndpoints: 'sophos_endpoints',
  sophosFirewalls: 'sophos_firewalls',
  sophosLicenses: 'sophos_licenses',
  dattoEndpoints: 'datto_endpoints',
  coveEndpoints: 'cove_endpoints'
};

const canonicalTableName = (table: string) => TABLE_ALIASES[table] ?? table;

const facetTableMap = new Map(
  [...getFacetTableMap()].map(([facet, table]) => [facet, canonicalTableName(table)])
);

function bullMqSafeKey(parts: Array<string | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join('__');
}

function checkConfigTable(checkConfig: unknown): string | undefined {
  if (checkConfig === null || typeof checkConfig !== 'object' || Array.isArray(checkConfig)) {
    return undefined;
  }

  const table = (checkConfig as Record<string, unknown>).table;
  return typeof table === 'string' ? canonicalTableName(table) : undefined;
}

function touchedTablesForFacets(facets?: ProviderFacet[]): Set<string> {
  return new Set(
    facets
      ?.map((facet) => facetTableMap.get(facet))
      .filter((table): table is string => table !== undefined)
  );
}

function checkMatchesTouchedTables(
  check: ReturnType<typeof checkRegistry.getAll>[number],
  touchedTables: Set<string>
): boolean {
  if (touchedTables.size === 0) return true;

  const sourceTables = check.sourceTables?.map(canonicalTableName) ?? [];
  if (sourceTables.length === 0) return true;

  return sourceTables.some((table) => touchedTables.has(table));
}

async function enqueueAssignedComplianceJobs(params: {
  db: Awaited<ReturnType<typeof getTenantServiceDbByOrgId>>['db'];
  queue: Queue<ComplianceJobData>;
  orgId: string;
  ingestRunId: string;
  siteId?: string;
  linkId?: string;
  facets?: ProviderFacet[];
}) {
  try {
    const { db, queue, orgId, ingestRunId, linkId, facets } = params;
    let siteId = params.siteId;
    let integrationId: string | undefined;

    if (linkId) {
      const [link] = await db
        .select({ integrationId: integrationLinks.integrationId, siteId: integrationLinks.siteId })
        .from(integrationLinks)
        .where(eq(integrationLinks.id, linkId))
        .limit(1);

      integrationId = link?.integrationId;
      siteId ??= link?.siteId ?? undefined;
    }

    if (!integrationId) {
      logger.info(
        { orgId, siteId, linkId },
        'No integration resolved for compliance assignment lookup'
      );
      return;
    }

    const assignmentConditions = [
      and(isNull(complianceAssignments.siteId), isNull(complianceAssignments.linkId))
    ];
    if (linkId) assignmentConditions.push(eq(complianceAssignments.linkId, linkId));
    if (siteId) {
      assignmentConditions.push(
        and(eq(complianceAssignments.siteId, siteId), isNull(complianceAssignments.linkId))
      );
    }

    const assignments = await db
      .select({
        frameworkId: complianceAssignments.frameworkId,
        siteId: complianceAssignments.siteId,
        linkId: complianceAssignments.linkId
      })
      .from(complianceAssignments)
      .innerJoin(
        complianceFrameworks,
        eq(complianceFrameworks.id, complianceAssignments.frameworkId)
      )
      .where(
        and(eq(complianceFrameworks.integrationId, integrationId), or(...assignmentConditions))
      );

    if (assignments.length === 0) {
      logger.info(
        { orgId, siteId, linkId, integrationId },
        'No compliance assignments matched ingestion scope'
      );
      return;
    }

    const assignmentsByFramework = new Map<string, typeof assignments>();
    for (const assignment of assignments) {
      const rows = assignmentsByFramework.get(assignment.frameworkId) ?? [];
      rows.push(assignment);
      assignmentsByFramework.set(assignment.frameworkId, rows);
    }

    const frameworkIds = [...assignmentsByFramework.entries()]
      .filter(([, rows]) => {
        const hasGlobal = rows.some((row) => row.siteId === null && row.linkId === null);
        const hasCurrentSpecific = rows.some(
          (row) => (linkId && row.linkId === linkId) || (siteId && row.siteId === siteId)
        );

        return hasGlobal ? !hasCurrentSpecific : hasCurrentSpecific;
      })
      .map(([frameworkId]) => frameworkId);

    if (frameworkIds.length === 0) {
      logger.info(
        { orgId, siteId, linkId, integrationId, assignments: assignments.length },
        'Compliance assignments excluded ingestion scope'
      );
      return;
    }

    const touchedTables = touchedTablesForFacets(facets);

    const checks = await db
      .select({
        frameworkId: complianceFrameworkChecks.frameworkId,
        checkConfig: complianceFrameworkChecks.checkConfig
      })
      .from(complianceFrameworkChecks)
      .where(
        and(
          inArray(complianceFrameworkChecks.frameworkId, frameworkIds),
          eq(complianceFrameworkChecks.enabled, true)
        )
      );

    if (checks.length === 0) {
      logger.info(
        { orgId, siteId, linkId, integrationId, frameworks: frameworkIds.length },
        'No enabled compliance checks matched assignments'
      );
      return;
    }

    const runnableFrameworkIds = new Set<string>();
    for (const check of checks) {
      const table = checkConfigTable(check.checkConfig);
      if (touchedTables.size === 0 || !table || touchedTables.has(table)) {
        runnableFrameworkIds.add(check.frameworkId);
      }
    }

    if (runnableFrameworkIds.size === 0) {
      logger.info(
        {
          orgId,
          siteId,
          linkId,
          integrationId,
          frameworks: frameworkIds.length,
          checks: checks.length,
          touchedTables: [...touchedTables]
        },
        'No compliance checks matched ingested tables'
      );
      return;
    }

    await Promise.all(
      [...runnableFrameworkIds].map((frameworkId) =>
        queue.add(
          bullMqSafeKey([QUEUES.COMPLIANCE, orgId, linkId ?? 'site', frameworkId]),
          { orgId, siteId, linkId, frameworkId },
          {
            jobId: bullMqSafeKey([
              QUEUES.COMPLIANCE,
              orgId,
              linkId ?? siteId ?? 'global',
              frameworkId,
              ingestRunId
            ]),
            removeOnComplete: 5,
            removeOnFail: 10
          }
        )
      )
    );

    if (runnableFrameworkIds.size > 0) {
      logger.info(
        { orgId, siteId, linkId, frameworks: runnableFrameworkIds.size },
        'Compliance jobs enqueued'
      );
    }
  } catch (err) {
    logger.error(
      { linkId: params.linkId, siteId: params.siteId, err },
      'Failed to queue compliance'
    );
  }
}

export function createAlertsWorker(redis: Redis) {
  const complianceQueue = new Queue<ComplianceJobData>(QUEUES.COMPLIANCE, { connection: redis });

  return new Worker<AlertsJobData>(
    QUEUES.ALERTS,
    async (job) => {
      const { siteId, linkId, orgId, ingestRunId, syncRunId, mode, facets } = job.data;

      let db: Awaited<ReturnType<typeof getTenantServiceDbByOrgId>>['db'];
      try {
        ({ db } = await getTenantServiceDbByOrgId(orgId, env.ENCRYPTION_KEY));
      } catch (err) {
        logger.error({ orgId, err }, 'Org not found — skipping alerts job');
        return;
      }

      const stageId = await startStage(
        db,
        syncRunId,
        'alerts',
        'alerts',
        'all',
        job.id ?? ingestRunId
      );

      const touchedTables = touchedTablesForFacets(facets);
      const checks = checkRegistry
        .getAll()
        .filter((check) => checkMatchesTouchedTables(check, touchedTables));
      logger.info(
        {
          orgId,
          siteId,
          linkId,
          run: ingestRunId,
          checks: checks.length,
          touchedTables: [...touchedTables]
        },
        'Alerts job started'
      );

      let detectionCount = 0;
      try {
        for (const check of checks) {
          let detections;
          try {
            detections = await check.evaluate({ siteId, linkId, db });
          } catch (err) {
            logger.error({ checkId: check.checkId, orgId, err }, 'Check evaluation failed');
            continue;
          }

          for (const detection of detections) {
            try {
              await upsertAlert(db, {
                definitionId: detection.definitionId,
                siteId,
                linkId,
                entityType: detection.entityType,
                entityRef: detection.entityRef,
                entityId: detection.entityId,
                severity: detection.severity,
                message: `[${detection.checkId}] ${detection.entityRef}`,
                metadata: detection.detail
              });
              detectionCount++;
            } catch (err) {
              logger.error(
                { checkId: check.checkId, entityRef: detection.entityRef, err },
                'Alert upsert failed'
              );
            }
          }

          for (const definitionId of check.definitionIds ?? [check.definitionId]) {
            await resolveMissingAlerts(db, {
              definitionIds: [definitionId],
              siteId,
              linkId,
              seenEntityRefs: detections
                .filter((detection) => detection.definitionId === definitionId)
                .map((detection) => detection.entityRef)
            });
          }

          logger.info(
            { checkId: check.checkId, orgId, detections: detections.length },
            'Check complete'
          );
        }

        await completeStage(db, stageId, { recordsOut: detectionCount });

        await enqueueAssignedComplianceJobs({
          db,
          queue: complianceQueue,
          orgId,
          ingestRunId,
          siteId,
          linkId,
          facets
        });

        // Finalize the sync_run
        await db
          .update(syncRuns)
          .set({ status: 'completed', finishedAt: new Date() })
          .where(eq(syncRuns.id, syncRunId));

        // Link-health feedback loop: if mode is not replay, check consecutive failures
        if (mode !== 'replay' && linkId) {
          const contexts = await db
            .select()
            .from(syncContext)
            .where(eq(syncContext.linkId, linkId));
          const unhealthy = contexts.some((c) => c.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES);

          if (unhealthy) {
            await db
              .update(integrationLinks)
              .set({ status: 'error', updatedAt: new Date() })
              .where(eq(integrationLinks.id, linkId));
            logger.warn(
              { orgId, linkId },
              'Link marked error: consecutive failure threshold reached'
            );
          } else {
            // Auto-recover: reset to active if it was previously in error
            const [link] = await db
              .select({ status: integrationLinks.status })
              .from(integrationLinks)
              .where(eq(integrationLinks.id, linkId))
              .limit(1);
            if (link?.status === 'error') {
              await db
                .update(integrationLinks)
                .set({ status: 'active', updatedAt: new Date() })
                .where(eq(integrationLinks.id, linkId));
              logger.info({ orgId, linkId }, 'Link auto-recovered to active');
            }
          }
        }

        logger.info({ orgId, siteId, linkId, run: ingestRunId }, 'Alerts job complete');
      } catch (err) {
        await failStage(db, stageId, err);
        await db
          .update(syncRuns)
          .set({ status: 'failed', finishedAt: new Date() })
          .where(eq(syncRuns.id, syncRunId));
        throw err;
      }
    },
    { connection: redis, concurrency: 3 }
  );
}
