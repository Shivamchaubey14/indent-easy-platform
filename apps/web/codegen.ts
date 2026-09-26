import type { CodegenConfig } from '@graphql-codegen/cli';

// Typed GraphQL documents for the web app: write `graphql(\`query ...\`)` in a feature's api/
// folder and codegen produces the TypedDocumentNode, so results and variables are fully typed.
const config: CodegenConfig = {
  schema: '../../packages/graphql/schema/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/generated/**'],
  ignoreNoDocuments: true,
  generates: {
    'src/generated/graphql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        strictScalars: true,
        scalars: {
          Decimal: 'string',
          DateTime: 'string',
          Date: 'string',
          PhoneNumber: 'string',
          EmailAddress: 'string',
          JSON: 'unknown',
          CurrencyCode: 'string',
          UUID: 'string',
        },
      },
    },
  },
};

export default config;
