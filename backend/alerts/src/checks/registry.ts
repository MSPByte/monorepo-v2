import type { CheckEvaluator } from './interface.js';
import {
  coveEndpointErrorsCheck,
  coveEndpointLastSuccessStaleCheck
} from './cove/endpoints.js';
import {
  licenseExpiringSoonCheck,
  licenseUnusedSeatsCheck
} from './microsoft-365/license-utilization.js';
import { inboxRulesCheck } from './microsoft-365/inbox-rules.js';
import {
  mailboxExternalSmtpCheck,
  mailboxInternalForwardCheck
} from './microsoft-365/mailbox-forwarding.js';
import { mfaEnforcedCheck } from './microsoft-365/mfa-enforced.js';
import { staleIdentityCheck } from './microsoft-365/stale-identity.js';
import { sophosStaleEndpointCheck } from './sophos/stale-endpoint.js';
import { sophosStaleFirewallCheck } from './sophos/stale-firewall.js';
import { sophosTamperProtectionCheck } from './sophos/tamper-protection.js';
import { sophosEndpointNeedsUpdateCheck } from './sophos/update-endpoint.js';
import { sophosFirewallNeedsUpdateCheck } from './sophos/update-firewall.js';

const checks = new Map<string, CheckEvaluator>([
  [coveEndpointErrorsCheck.checkId, coveEndpointErrorsCheck],
  [coveEndpointLastSuccessStaleCheck.checkId, coveEndpointLastSuccessStaleCheck],
  [mfaEnforcedCheck.checkId, mfaEnforcedCheck],
  [staleIdentityCheck.checkId, staleIdentityCheck],
  [licenseUnusedSeatsCheck.checkId, licenseUnusedSeatsCheck],
  [licenseExpiringSoonCheck.checkId, licenseExpiringSoonCheck],
  [mailboxExternalSmtpCheck.checkId, mailboxExternalSmtpCheck],
  [mailboxInternalForwardCheck.checkId, mailboxInternalForwardCheck],
  [inboxRulesCheck.checkId, inboxRulesCheck],
  [sophosTamperProtectionCheck.checkId, sophosTamperProtectionCheck],
  [sophosStaleEndpointCheck.checkId, sophosStaleEndpointCheck],
  [sophosStaleFirewallCheck.checkId, sophosStaleFirewallCheck],
  [sophosEndpointNeedsUpdateCheck.checkId, sophosEndpointNeedsUpdateCheck],
  [sophosFirewallNeedsUpdateCheck.checkId, sophosFirewallNeedsUpdateCheck],
]);

export const checkRegistry = {
  getAll: (): CheckEvaluator[] => [...checks.values()],
  get: (checkId: string): CheckEvaluator | undefined => checks.get(checkId),
  register: (check: CheckEvaluator) => checks.set(check.checkId, check),
};
