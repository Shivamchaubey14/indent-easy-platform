import type { RequestHandler } from 'express';
import { currentContext, type Principal } from '../../../shared/context.js';
import { sendProblem } from '../../../shared/http/problem.js';
import type { AccessTokens } from '../infrastructure/access-tokens.js';
import type { AuthGuards } from '../infrastructure/guards.js';

/**
 * Reads `Authorization: Bearer <token>`. A valid token of a live session sets the request's
 * principal; a bad, expired or revoked one is answered with 401 at once (the client then refreshes
 * or signs in again). Requests without a token pass through anonymously; handlers that need a user
 * call `requirePrincipal`.
 */
export function authenticate(tokens: AccessTokens, guards: AuthGuards): RequestHandler {
  return (req, res, next) => {
    const header = req.get('authorization');
    if (!header) {
      next();
      return;
    }
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      sendProblem(res, 'AUTH_TOKEN_EXPIRED', { detail: 'Use a Bearer access token.' });
      return;
    }
    void (async () => {
      let principal: Principal;
      try {
        principal = await tokens.verify(token);
      } catch {
        sendProblem(res, 'AUTH_TOKEN_EXPIRED', {
          detail: 'The access token is invalid or expired.',
        });
        return;
      }
      if (await guards.isRevoked(principal.sessionId)) {
        sendProblem(res, 'AUTH_TOKEN_EXPIRED', { detail: 'This session has been signed out.' });
        return;
      }
      const context = currentContext();
      if (context) context.principal = principal;
      next();
    })().catch(next);
  };
}

/** The signed-in user, or a 401 problem sent and undefined returned. */
export function requirePrincipal(
  res: Parameters<RequestHandler>[1],
  options: { allowPendingPasswordChange?: boolean } = {},
): Principal | undefined {
  const principal = currentContext()?.principal;
  if (!principal) {
    sendProblem(res, 'AUTH_TOKEN_EXPIRED', { detail: 'Sign in to continue.' });
    return undefined;
  }
  // AUTH-013: a temporary password must be replaced before anything else.
  if (principal.mustChangePassword && !options.allowPendingPasswordChange) {
    sendProblem(res, 'FORBIDDEN', {
      detail: 'Change your password to continue.',
      details: { reason: 'PASSWORD_CHANGE_REQUIRED' },
    });
    return undefined;
  }
  return principal;
}
