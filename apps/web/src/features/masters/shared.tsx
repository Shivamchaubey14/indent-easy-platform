import { Button, ErrorState, type Tone } from '@ie/ui';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '../../lib/api';
import { meQuery } from '../../lib/me';
import { catalogReferenceQuery } from './api';

/** Units, conversions, categories, code systems and locations for pick lists. */
export function useCatalogReference() {
  return useQuery(catalogReferenceQuery);
}

/** Whether the signed-in user holds a permission (for showing controls; the API decides). */
export function usePermissions() {
  const me = useQuery(meQuery);
  const permissions = me.data?.permissions ?? [];
  return (permission: string) => permissions.includes(permission);
}

/** An error from a query, with its request id and a retry. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <ErrorState
      requestId={error instanceof ApiRequestError ? error.requestId : undefined}
      onRetry={onRetry}
    />
  );
}

/** Server cursor paging: remembers the cursors of earlier pages so "previous" can step back. */
export function useCursorPages() {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  return {
    after: cursors.at(-1) ?? null,
    isFirst: cursors.length === 1,
    reset: () => setCursors([null]),
    back: () => setCursors((c) => c.slice(0, -1)),
    forward: (cursor: string | null | undefined) => setCursors((c) => [...c, cursor ?? null]),
  };
}

export function Pager({
  pages,
  pageInfo,
}: {
  pages: ReturnType<typeof useCursorPages>;
  pageInfo: { hasNextPage: boolean; endCursor?: string | null };
}) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-between">
      <Button variant="secondary" size="sm" disabled={pages.isFirst} onClick={pages.back}>
        {t('admin.previous')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={!pageInfo.hasNextPage}
        onClick={() => pages.forward(pageInfo.endCursor)}
      >
        {t('admin.next')}
      </Button>
    </div>
  );
}

export const activeTone = (status: string): Tone =>
  status === 'ACTIVE' ? 'success' : status === 'BLOCKED' ? 'danger' : 'neutral';

/** Table header cell with the shared look. */
export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <th scope="col" className={`px-4 py-3 font-medium ${className}`}>
      {children}
    </th>
  );
}
