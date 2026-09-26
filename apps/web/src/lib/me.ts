import { queryOptions } from '@tanstack/react-query';
import { graphql } from '../generated/graphql';
import { gql } from './api';

const MeQuery = graphql(`
  query Me {
    me {
      id
      displayName
      email
      employeeCode
      homeWorkspace
      permissions
      primaryLocation {
        id
        name
      }
    }
  }
`);

/** The signed-in user: who they are and what they may do (server state, TanStack Query). */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => (await gql(MeQuery)).me,
  staleTime: 5 * 60_000,
});
