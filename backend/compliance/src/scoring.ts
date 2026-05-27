type ComplianceResult = {
  status: 'pass' | 'fail' | 'suppressed' | 'error';
  severity?: number;
};

export function scoreFramework(results: ComplianceResult[]): number {
  if (results.length === 0) return 100;

  const countable = results.filter((r) => r.status !== 'suppressed' && r.status !== 'error');
  if (countable.length === 0) return 100;

  const passed = countable.filter((r) => r.status === 'pass').length;
  return Math.round((passed / countable.length) * 100);
}
