import { describe, expect, it } from 'vitest';
import { ProviderFacet } from '../libs/provider.js';
import { buildLinkFlow } from './flow-builder.js';

describe('buildLinkFlow', () => {
  it('uses a unique root job id per ingestion run', () => {
    const base = {
      orgId: 'org-1',
      linkId: 'link-1',
      provider: 'microsoft-365',
      facets: [ProviderFacet.M365CAPolicies],
      syncRunId: 'sync-run-1',
      mode: 'full' as const,
    };

    const first = buildLinkFlow({ ...base, ingestRunId: 'ingest-run-1' });
    const second = buildLinkFlow({ ...base, ingestRunId: 'ingest-run-2' });

    expect(first.opts?.jobId).toBe('ingest_link-1_ingest-run-1');
    expect(second.opts?.jobId).toBe('ingest_link-1_ingest-run-2');
  });
});
