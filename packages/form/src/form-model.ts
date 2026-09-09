import { mergePolicy, validateSchema } from './schema.ts';
import { validateValues } from './validation.ts';
import type {
  FormModel,
  FormPolicy,
  FormSchema,
  FormUiConfig,
  FormValues,
} from './types.ts';

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
