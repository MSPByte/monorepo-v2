import type { CheckTypeEvaluator } from './types.js';
import { fieldEqualsEvaluator } from './field-equals.js';
import { fieldNotEqualsEvaluator } from './field-not-equals.js';
import { fieldCompareEvaluator } from './field-compare.js';
import { policyExistsEvaluator } from './policy-exists.js';
import { policyNotExistsEvaluator } from './policy-not-exists.js';
import { policyCountGteEvaluator } from './policy-count-gte.js';

export const checkTypeRegistry = new Map<string, CheckTypeEvaluator>([
  ['policy_exists', policyExistsEvaluator],
  ['policy_not_exists', policyNotExistsEvaluator],
  ['policy_count_gte', policyCountGteEvaluator],
  ['field_compare', fieldCompareEvaluator],
  ['field_equals', fieldEqualsEvaluator],
  ['field_not_equals', fieldNotEqualsEvaluator],
]);
