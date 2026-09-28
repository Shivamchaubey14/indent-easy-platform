import type { RequestHandler, Response } from 'express';
import type { Principal } from '../../../shared/context.js';
import { sendProblem } from '../../../shared/http/problem.js';
import type { Requester } from '../../documents/index.js';
import type { ImportService } from '../application/import-service.js';

export type ImportsOperationId = 'downloadImportTemplate';

/** GET /api/v1/imports/templates/{kind}: the kind's template with the current data. */
export function importsHandlers(options: {
  service: ImportService;
  principal: (res: Response) => Principal | undefined;
  requester: (principal: Principal) => Promise<Requester>;
}): Record<ImportsOperationId, RequestHandler> {
  return {
    downloadImportTemplate: (req, res, next) => {
      const signedIn = options.principal(res);
      if (!signedIn) return;
      void (async () => {
        const who = await options.requester(signedIn);
        const kind = String(req.params['kind'] ?? '');
        const handler = options.service.handler(kind);
        if (!handler) {
          sendProblem(res, 'NOT_FOUND', { detail: 'No such import.' });
          return;
        }
        if (!who.grants.can(handler.permission)) {
          sendProblem(res, 'FORBIDDEN', { detail: 'You cannot use this import.' });
          return;
        }
        const file = await options.service.template(who, kind);
        res.setHeader('Cache-Control', 'no-store');
        res.attachment(file.fileName);
        res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(file.body);
      })().catch(next);
    },
  };
}
