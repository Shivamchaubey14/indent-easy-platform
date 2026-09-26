import { useSessionStore } from '../stores/session';
import { refreshSession } from './auth';
import { ApiRequestError, http, type HttpOptions } from './http';

export { ApiRequestError, apiBaseUrl } from './http';

/**
 * Sends with the current access token; if it was refused (expired, or older than a role change),
 * refreshes once and tries again.
 */
async function withFreshToken<T>(send: (accessToken: string | null) => Promise<T>): Promise<T> {
  try {
    return await send(useSessionStore.getState().accessToken);
  } catch (err) {
    const refused = err instanceof ApiRequestError && err.code === 'AUTH_TOKEN_EXPIRED';
    if (refused && useSessionStore.getState().status === 'signedIn' && (await refreshSession())) {
      return send(useSessionStore.getState().accessToken);
    }
    throw err;
  }
}

/** JSON REST call. Readiness answers 503 with a body that describes the failing checks. */
export function rest<T>(path: string, options: Omit<HttpOptions, 'accessToken'> = {}): Promise<T> {
  return withFreshToken((accessToken) =>
    http<T>(path, { acceptStatus: [503], ...options, accessToken }),
  );
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

/**
 * A GraphQL operation. Typed documents (codegen) come with the first mobile feature that needs
 * more than a couple of queries; until then callers state the result type.
 */
export function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  return withFreshToken(async (accessToken) => {
    const body = await http<GraphQLResponse<T>>('/graphql', {
      method: 'POST',
      body: { query, variables },
      accessToken,
    });
    const first = body.errors?.[0];
    if (first || !body.data) {
      throw new ApiRequestError(
        first?.message ?? 'Request failed',
        first?.extensions?.code ?? 'INTERNAL_ERROR',
        '',
      );
    }
    return body.data;
  });
}
