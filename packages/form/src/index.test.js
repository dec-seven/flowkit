import assert from 'node:assert/strict';
import { FormValidationError, createFormModel } from './index.js';
const schema = { ref: { schemaId: 'leave', version: 1 }, fields: [{ key: 'days', type: 'number', label: '天数', required: true }] };
const model = createFormModel(schema, { values: { days: 2 } });
assert.deepEqual(model.validate().values, { days: 2 });
assert.throws(() => createFormModel(schema, { values: {} }).validate(), FormValidationError);
console.log('form tests passed');
