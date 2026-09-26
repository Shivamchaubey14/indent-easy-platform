import type { UserError } from '@ie/graphql';
import { saveLocationInputSchema, saveMasterInputSchema, toUserErrors } from '@ie/validation';
import type { GraphQLContext } from '../../graphql/context.js';
import { recordAudit } from '../../shared/audit.js';
import { type Pool, type PoolClient, withOrgContext } from '../../shared/database.js';

type Saved<T extends string> = { [K in T]: unknown } & { userErrors: UserError[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const problem = (field: string, message: string, code: UserError['code']): UserError => ({
  code,
  message,
  field: ['input', field],
  details: null,
});

class Duplicate extends Error {}
class Missing extends Error {}

/** Runs an insert/update, turning unique violations and missing rows into user errors. */
async function saving(work: () => Promise<string>): Promise<{ id: string } | { error: UserError }> {
  try {
    return { id: await work() };
  } catch (err) {
    const pg = err as { code?: string };
    if (err instanceof Duplicate || pg.code === '23505') {
      return { error: problem('code', 'validation.codeTaken', 'CONFLICT') };
    }
    if (err instanceof Missing) return { error: problem('id', 'validation.notFound', 'NOT_FOUND') };
    throw err;
  }
}

async function upsert(
  client: PoolClient,
  options: {
    organizationId: string;
    table: string;
    entityType: string;
    id: string | null;
    columns: Record<string, unknown>;
    select: string;
  },
): Promise<string> {
  const { table, columns } = options;
  const names = Object.keys(columns);
  const values = Object.values(columns);
  let before: object | null = null;
  let id = options.id;
  if (id) {
    if (!UUID.test(id)) throw new Missing();
    const existing = await client.query(
      `SELECT ${options.select} FROM ${table} WHERE id = $1 FOR UPDATE`,
      [id],
    );
    before = (existing.rows[0] as object | undefined) ?? null;
    if (!before) throw new Missing();
    await client.query(
      `UPDATE ${table} SET ${names.map((n, i) => `${n} = $${i + 2}`).join(', ')} WHERE id = $1`,
      [id, ...values],
    );
  } else {
    const created = await client.query<{ id: string }>(
      `INSERT INTO ${table} (organization_id, ${names.join(', ')})
       VALUES ($1, ${names.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
      [options.organizationId, ...values],
    );
    id = created.rows[0]!.id;
  }
  const after = await client.query(`SELECT ${options.select} FROM ${table} WHERE id = $1`, [id]);
  const code = (after.rows[0] as { code?: string } | undefined)?.code ?? null;
  await recordAudit(client, {
    organizationId: options.organizationId,
    action: `${options.entityType.toUpperCase()}_${before ? 'UPDATED' : 'CREATED'}`,
    entityType: options.entityType,
    entityId: id,
    entityNumber: code,
    before,
    after: (after.rows[0] as object | undefined) ?? null,
  });
  return id;
}

const LOCATION_SELECT = `code, name, name_hi AS "nameHi", type, sap_plant_code AS "sapPlantCode",
  address, excluded_from_cross_view AS "excludedFromCrossView", status`;

/**
 * Organisation masters (USR-004, USR-005): locations, departments, designations. Codes are unique
 * per organisation; every change is audited in its transaction.
 */
export function organizationAdmin(pool: Pool) {
  return {
    saveLocation: async (organizationId: string, raw: unknown) => {
      const parsed = saveLocationInputSchema.safeParse(raw);
      if (!parsed.success) return { userErrors: toUserErrors(parsed.error) };
      const input = parsed.data;
      return saving(() =>
        withOrgContext(pool, organizationId, (client) =>
          upsert(client, {
            organizationId,
            table: 'org.location',
            entityType: 'Location',
            id: input.id ?? null,
            select: LOCATION_SELECT,
            columns: {
              code: input.code,
              name: input.name,
              name_hi: input.nameHi ?? null,
              type: input.type,
              sap_plant_code: input.sapPlantCode ?? null,
              address: input.address ?? null,
              excluded_from_cross_view: input.excludedFromCrossView,
              status: input.active ? 'ACTIVE' : 'INACTIVE',
            },
          }),
        ),
      );
    },
    saveMaster: async (
      organizationId: string,
      kind: 'department' | 'designation',
      raw: unknown,
    ) => {
      const parsed = saveMasterInputSchema.safeParse(raw);
      if (!parsed.success) return { userErrors: toUserErrors(parsed.error) };
      const input = parsed.data;
      return saving(() =>
        withOrgContext(pool, organizationId, (client) =>
          upsert(client, {
            organizationId,
            table: `org.${kind}`,
            entityType: kind === 'department' ? 'Department' : 'Designation',
            id: input.id ?? null,
            select: 'code, name',
            columns: { code: input.code, name: input.name },
          }),
        ),
      );
    },
  };
}

export type OrganizationAdmin = ReturnType<typeof organizationAdmin>;

type SaveResult = { userErrors: UserError[] } | { id: string } | { error: UserError };

/** Turns a save result into the contract's payload, reading the saved record from the directory. */
async function payload<K extends string>(
  ctx: GraphQLContext,
  key: K,
  result: SaveResult,
  find: (id: string) => Promise<unknown>,
): Promise<Saved<K>> {
  if ('userErrors' in result) return { [key]: null, userErrors: result.userErrors } as Saved<K>;
  if ('error' in result) return { [key]: null, userErrors: [result.error] } as Saved<K>;
  ctx.invalidateDirectory();
  return { [key]: await find(result.id), userErrors: [] } as Saved<K>;
}

export const organizationAdminResolvers = {
  Mutation: {
    saveLocation: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        ctx,
        'location',
        await ctx.services.organizationAdmin.saveLocation(ctx.viewer().organizationId, args.input),
        async (id) => (await ctx.directory()).location(id),
      ),
    saveDepartment: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        ctx,
        'department',
        await ctx.services.organizationAdmin.saveMaster(
          ctx.viewer().organizationId,
          'department',
          args.input,
        ),
        async (id) => (await ctx.directory()).department(id),
      ),
    saveDesignation: async (_p: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      payload(
        ctx,
        'designation',
        await ctx.services.organizationAdmin.saveMaster(
          ctx.viewer().organizationId,
          'designation',
          args.input,
        ),
        async (id) => (await ctx.directory()).designation(id),
      ),
  },
};
