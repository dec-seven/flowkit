import type { AdapterCapabilities } from '@flowkit/core';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type HeadersFactory = HeadersInit | (() => HeadersInit | Promise<HeadersInit>);

export interface RestEndpointMap {
  definitions: (definitionId: string, version: number) => string;
  formSchemas: (schemaId: string, version: number) => string;
  instances: (instanceId: string) => string;
  instanceCollection: string;
  tasks: (taskId: string) => string;
  taskCollection: string;
  taskActions: (taskId: string) => string;
  history: (instanceId: string) => string;
}

export interface RestAdapterOptions {
  baseUrl: string;
  fetch?: FetchLike;
  headers?: HeadersFactory;
  /** Return a current bearer token for each request. */
  getToken?: () => string | undefined | Promise<string | undefined>;
  /** Called before an expired-auth error is returned to the caller. */
  onAuthExpired?: () => void | Promise<void>;
  /** Defaults are conservative: unknown servers do not get concurrency guarantees. */
  capabilities?: Partial<AdapterCapabilities>;
  endpoints?: Partial<RestEndpointMap>;
}
