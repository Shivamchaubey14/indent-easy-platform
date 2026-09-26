/// <reference types="expo/types" />

// Local database migrations, inlined as strings by babel-plugin-inline-import.
declare module '*.sql' {
  const sql: string;
  export default sql;
}
