import type { CheckEvaluator } from './interface.js';
import { mfaEnforcedCheck } from './mfa-enforced.js';
import { staleIdentityCheck } from './stale-identity.js';
import { mailboxExternalSmtpCheck, mailboxInternalForwardCheck } from './mailbox-forwarding.js';
import { inboxRulesCheck } from './inbox-rules.js';
import { sophosTamperProtectionCheck } from './sophos-tamper-protection.js';

const checks = new Map<string, CheckEvaluator>([
  [mfaEnforcedCheck.checkId, mfaEnforcedCheck],
  [staleIdentityCheck.checkId, staleIdentityCheck],
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
