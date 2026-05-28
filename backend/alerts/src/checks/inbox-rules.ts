import { eq, and } from 'drizzle-orm';
import { m365InboxRules } from '@mspbyte/drizzle';
import { externalInboxRuleRecipients } from '@mspbyte/shared';
import type { CheckEvaluator, CheckInput, Detection } from './interface.js';

export const inboxRulesCheck: CheckEvaluator = {
  checkId: 'suspicious_inbox_rules',
  definitionId: 'microsoft-365.inboxRules.deleteMessage',
  definitionIds: [
    'microsoft-365.inboxRules.deleteMessage',
    'microsoft-365.inboxRules.externalForward',
    'microsoft-365.inboxRules.redirectsMessage'
  ],
  sourceTables: ['m365_inbox_rules'],

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

      const externalForwardTo = externalInboxRuleRecipients(rule.forwardTo, rule.mailboxUpn);
      const externalForwardAsAttachmentTo = externalInboxRuleRecipients(
        rule.forwardAsAttachmentTo,
        rule.mailboxUpn
      );
      if (externalForwardTo.length > 0 || externalForwardAsAttachmentTo.length > 0) {
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
            forwardTo: externalForwardTo,
            forwardAsAttachmentTo: externalForwardAsAttachmentTo,
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
