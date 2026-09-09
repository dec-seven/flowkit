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
