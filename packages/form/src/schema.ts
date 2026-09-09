import { FORM_FIELD_TYPES } from './types.ts';
import type { FieldPolicy, FormPolicy, FormSchema, FormUiConfig } from './types.ts';

export function validateSchema(schema: FormSchema): FormSchema {
  if (!schema?.ref?.schemaId || !Number.isInteger(schema.ref.version)) {
    throw new Error('FormSchema.ref requires schemaId and integer version');
  }
  if (!Array.isArray(schema.fields)) {
    throw new Error('FormSchema.fields must be an array');
  }
  const keys = new Set<string>();
  for (const field of schema.fields) {
    if (!field.key || !field.label || !FORM_FIELD_TYPES.includes(field.type)) {
      throw new Error(`Invalid form field: ${field.key ?? '(unknown)'}`);
    }
    if (keys.has(field.key)) {
      throw new Error(`Duplicate form field: ${field.key}`);
    }
    keys.add(field.key);
  }
  return schema;
}

export function mergePolicy(
  schema: FormSchema,
  ui: FormUiConfig = {},
  policy: FormPolicy = {},
): Record<string, FieldPolicy> {
  validateSchema(schema);
  const all = new Set(schema.fields.map((field) => field.key));
  const visible = policy.visible ? new Set(policy.visible) : all;
  return schema.fields.reduce<Record<string, FieldPolicy>>((result, field) => {
    const key = field.key;
    result[key] = {
      visible: visible.has(key),
      readonly: policy.readonly?.includes(key) ?? false,
      required: policy.required?.includes(key) ?? Boolean(field.required),
      disabled: policy.disabled?.includes(key) ?? false,
      ...ui.fields?.[key],
    };
    return result;
  }, {});
}
