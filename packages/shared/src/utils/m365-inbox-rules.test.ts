import { describe, expect, it } from 'vitest';
import {
  externalInboxRuleRecipients,
  isExternalInboxRuleRecipient
} from './m365-inbox-rules.js';

describe('m365 inbox rule recipient classification', () => {
  it('treats Exchange DN recipients as internal', () => {
    const recipient =
      '"Mary McGill" [EX:/o=ExchangeLabs/ou=Exchange Administrative Group (FYDIBOHF23SPDLT)/cn=Recipients/cn=8dc66ddd95d24b059bb3b380a386549a-mary]';

    expect(isExternalInboxRuleRecipient(recipient, 'kevin@redrhinoindustrial.com')).toBe(false);
  });

  it('treats same-domain SMTP recipients as internal', () => {
    expect(
      isExternalInboxRuleRecipient(
        '"Mary McGill" [SMTP:mary@redrhinoindustrial.com]',
        'kevin@redrhinoindustrial.com'
      )
    ).toBe(false);
  });

  it('returns only recipients with clear external SMTP evidence', () => {
    expect(
      externalInboxRuleRecipients(
        [
          '"Mary McGill" [EX:/o=ExchangeLabs/ou=Exchange Administrative Group/cn=Recipients/cn=mary]',
          'SMTP:no-reply@supplysourceglobal.com'
        ],
        'kevin@redrhinoindustrial.com'
      )
    ).toEqual(['SMTP:no-reply@supplysourceglobal.com']);
  });
});
