import type {
  FormFieldPolicyInput,
  FormSchemaLike,
  FormUiLike,
  MergedFormFieldPolicy,
} from './types.ts';

/** Merge server policy over schema/UI defaults without mutating either input. */
export function mergeFormPolicy(
  schema: FormSchemaLike,
  ui: FormUiLike = {},
  policy: FormFieldPolicyInput = {},
): Record<string, MergedFormFieldPolicy> {
  const fields = schema?.fields ?? [];
  const visible = new Set(policy.visible ?? fields.map((field) => field.key));
  return fields.reduce<Record<string, MergedFormFieldPolicy>>((result, field) => {
    const key = field.key;
    result[key] = {
      visible: visible.has(key),
      readonly: (policy.readonly ?? []).includes(key),
      required: (policy.required ?? []).includes(key) || Boolean(field.required),
      disabled: (policy.disabled ?? []).includes(key),
      component: ui.fields?.[key]?.component,
      props: ui.fields?.[key]?.props ?? {},
    };
    return result;
  }, {});
}
