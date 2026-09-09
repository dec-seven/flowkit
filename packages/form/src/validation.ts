import { validateSchema } from './schema.ts';
import type {
  FieldPolicy,
  FormSchema,
  FormValidationResult,
  FormValues,
} from './types.ts';

export class FormValidationError extends Error {
  readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super('Form validation failed');
    this.name = 'FormValidationError';
    this.errors = errors;
  }
}

export function validateValues(
  schema: FormSchema,
  values: FormValues = {},
  policy: Record<string, FieldPolicy> = {},
): FormValidationResult {
  validateSchema(schema);
  const errors: Record<string, string> = {};
  for (const field of schema.fields) {
    const config = policy[field.key] ?? field;
    const value = values[field.key];
    if (
      config.visible !== false &&
      config.required &&
      (value === undefined || value === null || value === '')
    ) {
      errors[field.key] = '该字段为必填项';
    }
    if (value !== undefined && value !== null && value !== '') {
      if (field.type === 'number' && typeof value !== 'number') {
        errors[field.key] = '必须是数字';
      }
      if (typeof value === 'number') {
        if (field.validation?.min !== undefined && value < field.validation.min) {
          errors[field.key] = `不能小于 ${field.validation.min}`;
        }
        if (field.validation?.max !== undefined && value > field.validation.max) {
          errors[field.key] = `不能大于 ${field.validation.max}`;
        }
      }
    }
  }
  if (Object.keys(errors).length) {
    throw new FormValidationError(errors);
  }
  return { valid: true, values: { ...values } };
}
