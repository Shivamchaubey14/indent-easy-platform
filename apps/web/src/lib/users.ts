import { queryOptions } from '@tanstack/react-query';
import { graphql } from '../generated/graphql';
import { gql } from './api';

/** Active users by name, e-mail or employee code, for pickers (needs `admin:user_manage`). */
export const UserSearchQuery = graphql(`
  query UserSearch($search: String!) {
    users(filter: { search: $search, status: [ACTIVE, INVITED] }, pagination: { first: 8 }) {
      edges {
        node {
          id
          displayName
          employeeCode
          email
        }
      }
    }
  }
`);

export const userSearchQuery = (search: string) =>
  queryOptions({
    queryKey: ['users', 'search', search],
    queryFn: async () => (await gql(UserSearchQuery, { search })).users.edges.map((e) => e.node),
    staleTime: 30_000,
  });
