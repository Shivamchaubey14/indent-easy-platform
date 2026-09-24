// Writes dist/api-surface.json: which GraphQL operations and REST routes this build actually
// implements. The docs site turns it into the implementation status page. Runs after tsc.
import { writeFileSync } from 'node:fs';
import { implementedOperations } from '../dist/graphql/resolvers.js';
import { REST_ROUTES } from '../dist/rest/routes.js';

const surface = {
  graphql: implementedOperations(),
  rest: REST_ROUTES.map(({ operationId, method, path }) => ({ operationId, method, path })),
};

writeFileSync(
  new URL('../dist/api-surface.json', import.meta.url),
  JSON.stringify(surface, null, 2) + '\n',
);
console.log(
  `api surface: ${surface.graphql.query.length + surface.graphql.mutation.length} GraphQL operations, ${surface.rest.length} REST routes`,
);
