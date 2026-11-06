import { getValidationRules } from '../db/queries';
import type { ValidationRule } from '../../../shared/src/types';

type RuleEvaluator = (value: unknown, config: Record<string, unknown>) => boolean;

const evaluators: Record<string, RuleEvaluator> = {
  regex: (value, config) => new RegExp(config.pattern as string).test(String(value ?? '')),
  enum: (value, config) => (config.values as string[]).includes(String(value)),
  required: (value) => value !== null && value !== undefined && value !== '',
};

let cachedRules: ValidationRule[] | null = null;

export async function loadRules(): Promise<ValidationRule[]> {
  if (!cachedRules) {
    cachedRules = await getValidationRules();
    console.log(`[Validation] Loaded ${cachedRules.length} rules`);
  }
  return cachedRules;
}

export function clearRuleCache(): void {
  cachedRules = null;
}

export async function validateField(
  entityType: string,
  fieldName: string,
  value: unknown,
): Promise<{ valid: boolean; errors: string[] }> {
  const rules = await loadRules();
  const applicable = rules.filter(
    (r) => r.entity_type === entityType && r.field_name === fieldName && r.active,
  );

  const errors: string[] = [];
  for (const rule of applicable) {
    const evaluator = evaluators[rule.rule_type];
    if (evaluator && !evaluator(value, rule.rule_config as Record<string, unknown>)) {
      errors.push(rule.message);
    }
  }

  return { valid: errors.length === 0, errors };
}
