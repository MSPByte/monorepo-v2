import { eq, and } from 'drizzle-orm';
import { m365InboxRules } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from './interface.js';

export const inboxRulesCheck: CheckEvaluator = {
  checkId: 'suspicious_inbox_rules',
  definitionId: 'microsoft-365.inboxRules.deleteMessage',

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [eq(m365InboxRules.isSuspicious, true)];
    if (linkId) conditions.push(eq(m365InboxRules.linkId, linkId));

    const rows = await db
      .select()
      .from(m365InboxRules)
      .where(and(...conditions));
    const detections: Detection[] = [];

    for (const rule of rows) {
      const reasons = (rule.suspicionReasons as string[] | null) ?? [];

      if (rule.deleteMessage) {
        detections.push({
          checkId: 'suspicious_inbox_rules',
          definitionId: 'microsoft-365.inboxRules.deleteMessage',
          linkId,
          entityType: 'inbox_rule',
          entityRef: `${rule.mailboxUpn}::${rule.ruleName}`,
          entityId: rule.id,
          severity: 3,
          detail: { mailboxUpn: rule.mailboxUpn, ruleName: rule.ruleName, reasons }
        });
      }

      const forwardsExternally = Array.isArray(rule.forwardTo) && rule.forwardTo.length > 0;
      if (forwardsExternally) {
        detections.push({
          checkId: 'suspicious_inbox_rules',
          definitionId: 'microsoft-365.inboxRules.externalForward',
          linkId,
          entityType: 'inbox_rule',
          entityId: rule.id,
          entityRef: `${rule.mailboxUpn}::${rule.ruleName}`,
          severity: 2,
          detail: {
            mailboxUpn: rule.mailboxUpn,
            ruleName: rule.ruleName,
            forwardTo: rule.forwardTo,
            reasons
          }
        });
      }

      const redirects = Array.isArray(rule.redirectTo) && rule.redirectTo.length > 0;
      if (redirects) {
        detections.push({
          checkId: 'suspicious_inbox_rules',
          definitionId: 'microsoft-365.inboxRules.redirectsMessage',
          linkId,
          entityType: 'inbox_rule',
          entityId: rule.id,
          entityRef: `${rule.mailboxUpn}::${rule.ruleName}`,
          severity: 2,
          detail: {
            mailboxUpn: rule.mailboxUpn,
            ruleName: rule.ruleName,
            redirectTo: rule.redirectTo,
            reasons
          }
        });
      }
    }

    return detections;
  }
};
