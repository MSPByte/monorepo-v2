import { AlertSeverity } from '../../types/alerts.js';
import type { AlertDefinition } from '../../types/alerts.js';

export const MICROSOFT_365_ALERT_DEFINITIONS: Record<string, AlertDefinition> = {
  'microsoft-365.identities.stale': {
    id: 'microsoft-365.identities.stale',
    integrationId: 'microsoft-365',
    name: 'Stale Identity',
    tag: 'Stale',
    description: 'User account has not signed in for more than 30 days.',
    messageTemplate: '{{email}} has not signed in for more than 30 days.',
    severity: AlertSeverity.Low
  },
  'microsoft-365.identities.noMfa': {
    id: 'microsoft-365.identities.noMfa',
    integrationId: 'microsoft-365',
    name: 'MFA Not Enforced',
    tag: 'MFA',
    description: 'User account does not have MFA enforced.',
    messageTemplate: '{{email}} does not have MFA enforced.',
    severity: AlertSeverity.High
  },
  'microsoft-365.licenses.unusedSeats': {
    id: 'microsoft-365.licenses.unusedSeats',
    integrationId: 'microsoft-365',
    name: 'Unused License Seats',
    tag: 'Unused Seats',
    description: 'License SKU has unassigned seats and low utilization.',
    messageTemplate: '{{friendlyName}} has {{unusedUnits}} of {{totalUnits}} seats unassigned.',
    severity: AlertSeverity.High
  },
  'microsoft-365.licenses.expiringSoon': {
    id: 'microsoft-365.licenses.expiringSoon',
    integrationId: 'microsoft-365',
    name: 'License Seats Expiring Soon',
    tag: 'Expiring',
    description: 'License SKU has seats in warning or expiring state.',
    messageTemplate: '{{friendlyName}} has {{warningUnits}} seats expiring soon.',
    severity: AlertSeverity.Medium
  },
  'microsoft-365.mailboxForwarding.externalSmtp': {
    id: 'microsoft-365.mailboxForwarding.externalSmtp',
    integrationId: 'microsoft-365',
    name: 'Mailbox External SMTP Forwarding',
    tag: 'Ext Forward',
    description: 'Mailbox is configured to forward to an external SMTP address.',
    messageTemplate: '{{mailboxUpn}} is forwarding email to an external address.',
    severity: AlertSeverity.Medium
  },
  'microsoft-365.mailboxForwarding.internalForward': {
    id: 'microsoft-365.mailboxForwarding.internalForward',
    integrationId: 'microsoft-365',
    name: 'Mailbox Internal Forwarding',
    tag: 'Int Forward',
    description: 'Mailbox is configured to forward to an internal address.',
    messageTemplate: '{{mailboxUpn}} is forwarding email internally.',
    severity: AlertSeverity.Low
  },
  'microsoft-365.inboxRules.deleteMessage': {
    id: 'microsoft-365.inboxRules.deleteMessage',
    integrationId: 'microsoft-365',
    name: 'Inbox Rule: Delete Message',
    tag: 'Rule: Delete',
    description: 'Suspicious inbox rule configured to delete messages.',
    messageTemplate: '{{mailboxUpn}} has a delete-message inbox rule: {{ruleName}}.',
    severity: AlertSeverity.High
  },
  'microsoft-365.inboxRules.externalForward': {
    id: 'microsoft-365.inboxRules.externalForward',
    integrationId: 'microsoft-365',
    name: 'Inbox Rule: External Forward',
    tag: 'Rule: Ext Fwd',
    description: 'Suspicious inbox rule configured to forward messages externally.',
    messageTemplate: '{{mailboxUpn}} has an external-forward inbox rule: {{ruleName}}.',
    severity: AlertSeverity.Medium
  },
  'microsoft-365.inboxRules.redirectsMessage': {
    id: 'microsoft-365.inboxRules.redirectsMessage',
    integrationId: 'microsoft-365',
    name: 'Inbox Rule: Redirect Messages',
    tag: 'Rule: Redirect',
    description: 'Suspicious inbox rule configured to redirect messages.',
    messageTemplate: '{{mailboxUpn}} has a redirect-messages inbox rule: {{ruleName}}.',
    severity: AlertSeverity.Medium
  }
};
