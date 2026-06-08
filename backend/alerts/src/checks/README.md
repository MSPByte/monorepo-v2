# Alert Checks

Alert evaluators are grouped by integration. Keep each integration folder named after the vendor or product family, and keep filenames tied to the domain or alert group they evaluate.

## Cove

- `cove/endpoints.ts`
  - `cove_endpoint_errors`
  - `cove_endpoint_last_success_stale`

## Microsoft 365

- `microsoft-365/inbox-rules.ts`
  - `suspicious_inbox_rules`
    - `microsoft-365.inboxRules.deleteMessage`
    - `microsoft-365.inboxRules.externalForward`
    - `microsoft-365.inboxRules.redirectsMessage`
- `microsoft-365/license-utilization.ts`
  - `license_unused_seats`
  - `license_expiring_soon`
- `microsoft-365/mailbox-forwarding.ts`
  - `mailbox_external_smtp`
  - `mailbox_internal_forward`
- `microsoft-365/mfa-enforced.ts`
  - `mfa_enforced`
- `microsoft-365/stale-identity.ts`
  - `stale_identity`

## Sophos

- `sophos/tamper-protection.ts`
  - `sophos_tamper_protection`
- `sophos/stale-endpoint.ts`
  - `sophos_stale_endpoint`
- `sophos/stale-firewall.ts`
  - `sophos_stale_firewall`
- `sophos/update-endpoint.ts`
  - `sophos_endpoint_needs_update`
- `sophos/update-firewall.ts`
  - `sophos_firewall_needs_update`
