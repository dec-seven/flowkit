export const FORM_FIELD_TYPES = Object.freeze([
  'text',
  'number',
  'date',
  'select',
  'textarea',
  'boolean',
] as const);

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface FormFieldValidation {
  min?: number;
  max?: number;
  [property: string]: unknown;
}

export interface FormField {
  key: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  validation?: FormFieldValidation;
  [property: string]: unknown;
}

export interface FormSchema {
  ref: {
    schemaId: string;
    version: number;
  };
  fields: FormField[];
}

export interface FormFieldUiConfig {
  visible?: boolean;
  readonly?: boolean;
  required?: boolean;
  disabled?: boolean;
  component?: string;
  props?: Record<string, unknown>;
  [property: string]: unknown;
}

export interface FormUiConfig {
  fields?: Record<string, FormFieldUiConfig | undefined>;
}

export interface FormPolicy {
  visible?: string[];
  readonly?: string[];
  required?: string[];
  disabled?: string[];
}

export interface FieldPolicy {
  visible: boolean;
  readonly: boolean;
  required: boolean;
  disabled: boolean;
  component?: string;
  props?: Record<string, unknown>;
}

export type FormValues = Record<string, unknown>;

export interface FormValidationResult {
  valid: true;
  values: FormValues;
}

export interface FormModel {
  schema: FormSchema;
  ui?: FormUiConfig;
  policy: Record<string, FieldPolicy>;
  values: FormValues;
  validate: () => FormValidationResult;
}

export class FormValidationError extends Error {
  readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super('Form validation failed');
    this.name = 'FormValidationError';
    this.errors = errors;
  }
}

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

export function createFormModel(
  schema: FormSchema,
  {
    ui,
    policy,
    values = {},
  }: { ui?: FormUiConfig; policy?: FormPolicy; values?: FormValues } = {},
): FormModel {
  validateSchema(schema);
  const fieldPolicy = mergePolicy(schema, ui, policy);
  return {
    schema,
    ui,
    policy: fieldPolicy,
    values: { ...values },
    validate: () => validateValues(schema, values, fieldPolicy),
  };
}
