import { ERROR_CODE, FlowError } from '@flowkit/core';
import { isRecord } from './normalize.ts';
import type { FetchLike, HeadersFactory } from './types.ts';

export interface RestRequestOptions {
  method?: string;
  query?: Record<string, unknown>;
  body?: unknown;
}

export interface RestRequester {
  request(path: string, options?: RestRequestOptions): Promise<unknown>;
}

interface RestRequesterConfig {
  baseUrl: string;
  fetch: FetchLike;
  headers: HeadersFactory;
  getToken?: () => string | undefined | Promise<string | undefined>;
  onAuthExpired?: () => void | Promise<void>;
}

export function createRestRequester(config: RestRequesterConfig): RestRequester {
  const baseUrl = config.baseUrl.replace(/\/$/, '');

  return {
    async request(path, { method = 'GET', query, body }: RestRequestOptions = {}) {
      const url = new URL(path, `${baseUrl}/`);
      Object.entries(query ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          url.searchParams.set(key, String(value));
        }
      });

      const configuredHeaders =
        typeof config.headers === 'function' ? await config.headers() : config.headers;
      const headers = new Headers(configuredHeaders);
      headers.set('Accept', 'application/json');
      if (body !== undefined) headers.set('Content-Type', 'application/json');
      const token = await config.getToken?.();
      if (token) headers.set('Authorization', `Bearer ${token}`);

      let response: Response;
      try {
        response = await config.fetch(url.toString(), {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (error) {
        throw new FlowError(ERROR_CODE.TRIGGER_FAILED, 'REST request failed', {
          resource: 'network',
          cause: error instanceof Error ? error.message : String(error),
        });
      }

      const payload = await readPayload(response);
      if (!response.ok) {
        await throwHttpError(response.status, payload, config.onAuthExpired);
      }
      return payload;
    },
  };
}

async function readPayload(response: Response): Promise<unknown> {
  if (response.status === 204) return {};
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function throwHttpError(
  status: number,
  payload: unknown,
  onAuthExpired?: () => void | Promise<void>,
): Promise<never> {
  const root = isRecord(payload) ? payload : {};
  const source = isRecord(root.error) ? root.error : root;
  const code = typeof source.code === 'string' ? source.code : undefined;
  const message =
    typeof source.message === 'string' ? source.message : `REST request failed (${status})`;
  const details = isRecord(source.details)
    ? { ...source.details }
    : Object.fromEntries(
        Object.entries(source).filter(([key]) => !['code', 'message', 'error'].includes(key)),
      );

  if (status === 401) {
    await onAuthExpired?.();
    throw new FlowError(ERROR_CODE.AUTH_EXPIRED, message, { ...details, status });
  }
  if (status === 403) throw new FlowError(ERROR_CODE.FORBIDDEN, message, { ...details, status });
  if (status === 404) throw new FlowError(ERROR_CODE.NOT_FOUND, message, { ...details, status });
  if (status === 409 || code === ERROR_CODE.CONFLICT) {
    throw new FlowError(ERROR_CODE.CONFLICT, message, {
      resource: details.resource ?? 'task',
      currentTaskRevision: Number(details.currentTaskRevision ?? details.taskRevision ?? 0),
      currentInstanceRevision: Number(details.currentInstanceRevision ?? details.instanceRevision ?? 0),
      retryable: details.retryable !== false,
      ...details,
      status,
    });
  }
  const knownCode = Object.values(ERROR_CODE).includes(
    code as (typeof ERROR_CODE)[keyof typeof ERROR_CODE],
  )
    ? (code as (typeof ERROR_CODE)[keyof typeof ERROR_CODE])
    : ERROR_CODE.TRIGGER_FAILED;
  throw new FlowError(knownCode, message, { ...details, status });
}
