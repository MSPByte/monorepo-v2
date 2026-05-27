export type IngestError =
  | { kind: 'auth_failure'; retriable: false; message: string }
  | { kind: 'rate_limited'; retriable: true; retryAfter: number }
  | { kind: 'provider_error'; retriable: true; message: string }
  | { kind: 'schema_violation'; retriable: false; field: string; message: string }
  | { kind: 'partial_result'; retriable: true; message: string }
  | { kind: 'timeout'; retriable: true };

export function isRetriable(err: IngestError): boolean {
  return err.retriable;
}
