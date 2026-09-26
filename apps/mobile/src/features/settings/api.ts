import { queryOptions } from '@tanstack/react-query';
import { gql } from '../../lib/api';

export interface Me {
  id: string;
  displayName: string;
  email: string;
  employeeCode: string | null;
  primaryLocation: { name: string } | null;
}

/** The signed-in user, for the account section. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () =>
    (await gql<{ me: Me }>('{ me { id displayName email employeeCode primaryLocation { name } } }'))
      .me,
  staleTime: 5 * 60_000,
});
