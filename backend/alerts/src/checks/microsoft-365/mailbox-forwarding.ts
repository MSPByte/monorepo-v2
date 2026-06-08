import { eq, and, isNotNull } from 'drizzle-orm';
import { m365MailboxForwarding } from '@mspbyte/drizzle';
import type { CheckEvaluator, CheckInput, Detection } from '../interface.js';
import { alertSeverity } from '../severity.js';

export const mailboxExternalSmtpCheck: CheckEvaluator = {
  checkId: 'mailbox_external_smtp',
  definitionId: 'microsoft-365.mailboxForwarding.externalSmtp',
  sourceTables: ['m365_mailbox_forwarding'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [isNotNull(m365MailboxForwarding.forwardingSmtpAddress)];
    if (linkId) conditions.push(eq(m365MailboxForwarding.linkId, linkId));

    const rows = await db
      .select()
      .from(m365MailboxForwarding)
      .where(and(...conditions));

    return rows.map((row) => ({
      checkId: 'mailbox_external_smtp',
      definitionId: 'microsoft-365.mailboxForwarding.externalSmtp',
      linkId,
      entityType: 'mailbox',
      entityRef: row.userPrincipalName,
      entityId: row.id,
      severity: alertSeverity('microsoft-365.mailboxForwarding.externalSmtp'),
      detail: {
        userPrincipalName: row.userPrincipalName,
        forwardingSmtpAddress: row.forwardingSmtpAddress,
        deliverToMailboxAndForward: row.deliverToMailboxAndForward
      }
    }));
  }
};

export const mailboxInternalForwardCheck: CheckEvaluator = {
  checkId: 'mailbox_internal_forward',
  definitionId: 'microsoft-365.mailboxForwarding.internalForward',
  sourceTables: ['m365_mailbox_forwarding'],

  async evaluate({ linkId, db }: CheckInput): Promise<Detection[]> {
    const conditions = [isNotNull(m365MailboxForwarding.forwardingAddress)];
    if (linkId) conditions.push(eq(m365MailboxForwarding.linkId, linkId));

    const rows = await db
      .select()
      .from(m365MailboxForwarding)
      .where(and(...conditions));

    return rows.map((row) => ({
      checkId: 'mailbox_internal_forward',
      definitionId: 'microsoft-365.mailboxForwarding.internalForward',
      linkId,
      entityType: 'mailbox',
      entityRef: row.userPrincipalName,
      entityId: row.id,
      severity: alertSeverity('microsoft-365.mailboxForwarding.internalForward'),
      detail: {
        userPrincipalName: row.userPrincipalName,
        forwardingAddress: row.forwardingAddress,
        deliverToMailboxAndForward: row.deliverToMailboxAndForward
      }
    }));
  }
};
