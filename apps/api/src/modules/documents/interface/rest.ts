import type { Request, RequestHandler, Response } from 'express';
import type { Principal } from '../../../shared/context.js';
import { ApiError } from '../../../shared/errors.js';
import { sendProblem } from '../../../shared/http/problem.js';
import type { DocumentService, Requester } from '../application/document-service.js';
import { toMeta } from '../application/document-service.js';

export type FilesOperationId =
  'createUploadIntent' | 'completeUpload' | 'getDocument' | 'downloadDocument';

/** Statuses the contract gives these outcomes where HTTP is more precise than the catalogue. */
function statusOf(error: ApiError): number | undefined {
  if (error.code === 'DOCUMENT_TOO_LARGE') return 413;
  if (error.code === 'DOCUMENT_TYPE_NOT_ALLOWED') return 415;
  if (error.code === 'DOCUMENT_NOT_AVAILABLE') return 409;
  if (error.code === 'VALIDATION_FAILED' && error.details?.['reason']) return 422;
  return undefined;
}

export interface FilesRestOptions {
  service: DocumentService;
  /** The signed-in caller, or undefined after a 401 problem has been sent. */
  principal: (res: Response) => Principal | undefined;
  requester: (principal: Principal) => Promise<Requester>;
}

/** REST handlers for /api/v1/files/* (docs/api/openapi.yaml, SRS §35.2). */
export function filesHandlers({
  service,
  principal,
  requester,
}: FilesRestOptions): Record<FilesOperationId, RequestHandler> {
  const handle =
    (work: (req: Request, res: Response, who: Requester) => Promise<void>): RequestHandler =>
    (req, res, next) => {
      const signedIn = principal(res);
      if (!signedIn) return;
      requester(signedIn)
        .then((who) => work(req, res, who))
        .catch((err: unknown) => {
          if (!(err instanceof ApiError)) return next(err);
          const status = statusOf(err);
          sendProblem(res, err.code, {
            detail: err.message,
            ...(err.details && { details: err.details }),
            ...(status && { status }),
          });
        });
    };
  const documentId = (req: Request) => String(req.params['documentId'] ?? '');

  return {
    createUploadIntent: handle(async (req, res, who) => {
      res.setHeader('Cache-Control', 'no-store');
      res.status(201).json(await service.createUploadIntent(who, req.body));
    }),
    completeUpload: handle(async (req, res, who) => {
      res.status(202).json(await service.complete(who, documentId(req)));
    }),
    getDocument: handle(async (req, res, who) => {
      res.json(toMeta(await service.visible(who, documentId(req))));
    }),
    downloadDocument: handle(async (req, res, who) => {
      const disposition = req.query['disposition'] === 'inline' ? 'inline' : 'attachment';
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(302, await service.downloadUrl(who, documentId(req), disposition));
    }),
  };
}
