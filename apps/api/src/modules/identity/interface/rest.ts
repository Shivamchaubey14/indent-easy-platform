import {
  changePasswordInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  resetPasswordInputSchema,
} from '@ie/validation';
import { parseCookie } from 'cookie';
import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { currentContext } from '../../../shared/context.js';
import { ApiError } from '../../../shared/errors.js';
import { sendProblem } from '../../../shared/http/problem.js';
import type { AuthService, ClientInfo, Tokens } from '../application/auth-service.js';
import { platformOf } from '../domain/policy.js';
import type { AccessTokens } from '../infrastructure/access-tokens.js';
import type { CsrfTokens } from '../infrastructure/secrets.js';
import { requirePrincipal } from './authenticate.js';

const REFRESH_COOKIE = 'ie_rt';
const CSRF_COOKIE = 'ie_csrf';
const AUTH_PATH = '/api/v1/auth';

export type AuthOperationId =
  | 'login'
  | 'refreshToken'
  | 'getCsrfToken'
  | 'logout'
  | 'logoutAll'
  | 'forgotPassword'
  | 'resetPassword'
  | 'changePassword'
  | 'getJwks';

// Statuses the contract gives these outcomes, where HTTP is more precise than the catalogue.
function statusOf(error: ApiError): number | undefined {
  if (error.code === 'AUTH_ACCOUNT_LOCKED') return 423;
  if (error.details?.['reason'] === 'RESET_LINK_INVALID') return 410;
  return undefined;
}

function fail(res: Response, error: ApiError): void {
  const retryAfter = error.details?.['retryAfter'];
  if (typeof retryAfter === 'number') res.setHeader('Retry-After', String(retryAfter));
  const status = statusOf(error);
  sendProblem(res, error.code, {
    detail: error.message,
    ...(error.details && { details: error.details }),
    ...(status && { status }),
  });
}

/** Wraps a handler: expected ApiErrors become problem responses, the rest go to the error handler. */
function handle(work: (req: Request, res: Response) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    work(req, res).catch((err: unknown) => {
      if (err instanceof ApiError) fail(res, err);
      else next(err);
    });
  };
}

function parse<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || '_';
    (fieldErrors[field] ??= []).push(issue.message);
  }
  throw new ApiError('VALIDATION_FAILED', 'Check the highlighted fields.', { fieldErrors });
}

function clientInfo(): ClientInfo {
  const context = currentContext();
  return {
    platform: platformOf(context?.clientName),
    ip: context?.ip,
    clientVersion: context?.clientVersion,
  };
}

function cookies(req: Request): Record<string, string | undefined> {
  return parseCookie(req.get('cookie') ?? '');
}

export interface AuthRestOptions {
  service: AuthService;
  tokens: AccessTokens;
  csrf: CsrfTokens;
  /** Cookies are marked Secure when the app is served over HTTPS. */
  secureCookies: boolean;
}

/** REST handlers for /api/v1/auth/* and the JWKS (docs/api/openapi.yaml). */
export function authHandlers({
  service,
  tokens,
  csrf,
  secureCookies,
}: AuthRestOptions): Record<AuthOperationId, RequestHandler> {
  const refreshCookie = (maxAgeMs: number): CookieOptions => ({
    httpOnly: true,
    secure: secureCookies,
    sameSite: 'strict',
    path: AUTH_PATH,
    maxAge: maxAgeMs,
  });

  /**
   * Web: the refresh token goes into an HttpOnly cookie and never reaches JavaScript (AUTH-007).
   * Mobile: it is returned in the body for the app's secure storage (AUTH-008).
   */
  const sendTokens = (res: Response, tokens: Tokens, platform: ClientInfo['platform']) => {
    const refreshExpiresIn = Math.max(
      0,
      Math.floor((tokens.refreshExpiresAt.getTime() - Date.now()) / 1000),
    );
    if (platform === 'web') {
      res.cookie(REFRESH_COOKIE, tokens.refreshToken, refreshCookie(refreshExpiresIn * 1000));
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      accessToken: tokens.accessToken,
      tokenType: 'Bearer',
      expiresIn: tokens.expiresIn,
      sessionId: tokens.sessionId,
      ...(platform === 'mobile' && { refreshToken: tokens.refreshToken }),
      refreshExpiresIn,
      mustChangePassword: tokens.mustChangePassword,
    });
  };

  const clearRefreshCookie = (res: Response) =>
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookie(0), maxAge: undefined });

  return {
    login: handle(async (req, res) => {
      const input = parse(loginInputSchema, req.body);
      const client = clientInfo();
      sendTokens(res, await service.login(input, client), client.platform);
    }),

    refreshToken: handle(async (req, res) => {
      const client = clientInfo();
      let token: string | undefined;
      if (client.platform === 'mobile') {
        const body = (req.body ?? {}) as { refreshToken?: unknown };
        token = typeof body.refreshToken === 'string' ? body.refreshToken : undefined;
      } else {
        const jar = cookies(req);
        // The cookie is sent automatically by the browser, so it must come with proof that the
        // request was made by our own page (signed double-submit CSRF token, §30.1).
        if (!csrf.valid(req.get('x-csrf-token'), jar[CSRF_COOKIE])) {
          sendProblem(res, 'FORBIDDEN', {
            detail: 'Missing or invalid CSRF token.',
            details: { reason: 'CSRF' },
          });
          return;
        }
        token = jar[REFRESH_COOKIE];
      }
      if (!token) throw new ApiError('AUTH_TOKEN_EXPIRED', 'Sign in to continue.');
      try {
        sendTokens(res, await service.refresh(token, client), client.platform);
      } catch (err) {
        if (client.platform === 'web') clearRefreshCookie(res);
        throw err;
      }
    }),

    getCsrfToken: (_req, res) => {
      const token = csrf.issue();
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false,
        secure: secureCookies,
        sameSite: 'strict',
        path: '/',
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ csrfToken: token });
    },

    logout: handle(async (_req, res) => {
      const principal = requirePrincipal(res, { allowPendingPasswordChange: true });
      if (!principal) return;
      await service.logout(principal);
      clearRefreshCookie(res);
      res.status(204).end();
    }),

    logoutAll: handle(async (_req, res) => {
      const principal = requirePrincipal(res, { allowPendingPasswordChange: true });
      if (!principal) return;
      const revokedSessions = await service.logoutAll(principal);
      clearRefreshCookie(res);
      res.json({ revokedSessions });
    }),

    forgotPassword: handle(async (req, res) => {
      const { email } = parse(forgotPasswordInputSchema, req.body);
      await service.forgotPassword(email, clientInfo());
      res.status(202).end();
    }),

    resetPassword: handle(async (req, res) => {
      const { token, newPassword } = parse(resetPasswordInputSchema, req.body);
      await service.resetPassword(token, newPassword);
      clearRefreshCookie(res);
      res.status(204).end();
    }),

    changePassword: handle(async (req, res) => {
      const principal = requirePrincipal(res, { allowPendingPasswordChange: true });
      if (!principal) return;
      await service.changePassword(principal, parse(changePasswordInputSchema, req.body));
      res.status(204).end();
    }),

    getJwks: (_req, res) => {
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(tokens.jwks());
    },
  };
}
