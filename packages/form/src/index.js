export const FORM_FIELD_TYPES = Object.freeze(['text', 'number', 'date', 'select', 'textarea', 'boolean']);

export class FormValidationError extends Error {
  constructor(errors) { super('Form validation failed'); this.name = 'FormValidationError'; this.errors = errors; }
}

export function validateSchema(schema) {
  if (!schema?.ref?.schemaId || !Number.isInteger(schema.ref.version)) throw new Error('FormSchema.ref requires schemaId and integer version');
  if (!Array.isArray(schema.fields)) throw new Error('FormSchema.fields must be an array');
  const keys = new Set();
  for (const field of schema.fields) {
    if (!field.key || !field.label || !FORM_FIELD_TYPES.includes(field.type)) throw new Error(`Invalid form field: ${field.key ?? '(unknown)'}`);
    if (keys.has(field.key)) throw new Error(`Duplicate form field: ${field.key}`);
    keys.add(field.key);
  }
  return schema;
}

export function mergePolicy(schema, ui = {}, policy = {}) {
  validateSchema(schema);
  const all = new Set(schema.fields.map((field) => field.key));
  const visible = policy.visible ? new Set(policy.visible) : all;
  return schema.fields.reduce((result, field) => {
    const key = field.key;
    result[key] = { visible: visible.has(key), readonly: policy.readonly?.includes(key) ?? false, required: policy.required?.includes(key) ?? Boolean(field.required), disabled: policy.disabled?.includes(key) ?? false, ...ui.fields?.[key] };
    return result;
  }, {});
}

export function validateValues(schema, values = {}, policy = {}) {
  validateSchema(schema);
  const errors = {};
  for (const field of schema.fields) {
    const config = policy[field.key] ?? field;
    const value = values[field.key];
    if (config.visible !== false && config.required && (value === undefined || value === null || value === '')) errors[field.key] = '该字段为必填项';
    if (value !== undefined && value !== null && value !== '') {
      if (field.type === 'number' && typeof value !== 'number') errors[field.key] = '必须是数字';
      if (field.validation?.min !== undefined && value < field.validation.min) errors[field.key] = `不能小于 ${field.validation.min}`;
      if (field.validation?.max !== undefined && value > field.validation.max) errors[field.key] = `不能大于 ${field.validation.max}`;
    }
  }
  if (Object.keys(errors).length) throw new FormValidationError(errors);
  return { valid: true, values: { ...values } };
}

export function createFormModel(schema, { ui, policy, values = {} } = {}) {
  validateSchema(schema);
  const fieldPolicy = mergePolicy(schema, ui, policy);
  return { schema, ui, policy: fieldPolicy, values: { ...values }, validate: () => validateValues(schema, values, fieldPolicy) };
}
