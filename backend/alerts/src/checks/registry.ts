import type { CheckEvaluator } from './interface.js';
import { mfaEnforcedCheck } from './mfa-enforced.js';
import { staleIdentityCheck } from './stale-identity.js';
import { mailboxExternalSmtpCheck, mailboxInternalForwardCheck } from './mailbox-forwarding.js';
import { inboxRulesCheck } from './inbox-rules.js';
import { sophosTamperProtectionCheck } from './sophos-tamper-protection.js';
import { licenseExpiringSoonCheck, licenseUnusedSeatsCheck } from './license-utilization.js';
import {
  coveEndpointErrorsCheck,
  coveEndpointLastSuccessStaleCheck
} from './cove-endpoints.js';

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
]);

export const checkRegistry = {
  getAll: (): CheckEvaluator[] => [...checks.values()],
  get: (checkId: string): CheckEvaluator | undefined => checks.get(checkId),
  register: (check: CheckEvaluator) => checks.set(check.checkId, check),
};
