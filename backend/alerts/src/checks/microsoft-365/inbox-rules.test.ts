import { describe, expect, it, vi } from 'vitest';
import { inboxRulesCheck } from './inbox-rules.js';
import type { CheckInput } from '../interface.js';

function makeDb(rules: unknown[]) {
  const where = vi.fn().mockResolvedValue(rules);
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where })
      })
    } as unknown as CheckInput['db']
  };
}

function inboxRule(overrides: Record<string, unknown>) {
  return {
    id: 'rule-id',
    linkId: 'link-id',
    externalId: 'kevin@redrhinoindustrial.com::rule-name',
    mailboxUpn: 'kevin@redrhinoindustrial.com',
    ruleName: 'rule-name',
    ruleIdentity: 'rule-identity',
    enabled: true,
    deleteMessage: false,
    moveToFolder: null,
    forwardTo: null,
    forwardAsAttachmentTo: null,
    redirectTo: null,
    markAsRead: null,
    subjectContainsWords: null,
    isSuspicious: true,
    suspicionReasons: [],
    ...overrides
  };
}

describe('inboxRulesCheck', () => {
  it('does not alert on internal Exchange DN forwards', async () => {
    const { db } = makeDb([
      inboxRule({
        ruleName: 'No-Reply@SupplySourceGlobal.com',
        forwardTo: [
          '"Mary McGill" [EX:/o=ExchangeLabs/ou=Exchange Administrative Group (FYDIBOHF23SPDLT)/cn=Recipients/cn=8dc66ddd95d24b059bb3b380a386549a-mary]'
        ],
        suspicionReasons: ['forwardsExternally']
      })
    ]);

    const results = await inboxRulesCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(0);
  });

  it('alerts with only the external recipients in the detail', async () => {
    const { db } = makeDb([
      inboxRule({
        forwardTo: [
          '"Mary McGill" [EX:/o=ExchangeLabs/ou=Exchange Administrative Group/cn=Recipients/cn=mary]',
          'SMTP:no-reply@supplysourceglobal.com'
        ],
        forwardAsAttachmentTo: ['SMTP:archive@external.example'],
        suspicionReasons: ['forwardsExternally']
      })
    ]);

    const results = await inboxRulesCheck.evaluate({ db, linkId: 'link-id' });

    expect(results).toHaveLength(1);
    expect(results[0].definitionId).toBe('microsoft-365.inboxRules.externalForward');
    expect(results[0].detail.forwardTo).toEqual(['SMTP:no-reply@supplysourceglobal.com']);
    expect(results[0].detail.forwardAsAttachmentTo).toEqual(['SMTP:archive@external.example']);
  });
});
