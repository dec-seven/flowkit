import type { RestEndpointMap } from './types.ts';

export const DEFAULT_ENDPOINTS: RestEndpointMap = {
  definitions: (definitionId, version) =>
    `/flow-definitions/${encodeURIComponent(definitionId)}/versions/${version}`,
  formSchemas: (schemaId, version) =>
    `/form-schemas/${encodeURIComponent(schemaId)}/versions/${version}`,
  instances: (instanceId) => `/flow-instances/${encodeURIComponent(instanceId)}`,
  instanceCollection: '/flow-instances',
  tasks: (taskId) => `/tasks/${encodeURIComponent(taskId)}`,
  taskCollection: '/tasks',
  taskActions: (taskId) => `/tasks/${encodeURIComponent(taskId)}/actions`,
  history: (instanceId) => `/flow-instances/${encodeURIComponent(instanceId)}/events`,
};
