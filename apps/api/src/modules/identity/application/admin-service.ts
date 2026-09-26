import type { UserError } from '@ie/graphql';
import {
  createUserInputSchema,
  saveRoleInputSchema,
  setUserRolesInputSchema,
  toUserErrors,
  updateUserInputSchema,
} from '@ie/validation';
import type { z } from 'zod';
import type { Grants } from '../../../shared/authorization/index.js';
import type { Principal } from '../../../shared/context.js';
import type { Logger } from '../../../shared/logging.js';
import type { Directory } from '../../organization/index.js';
import type { AuthGuards } from '../infrastructure/guards.js';
import type { Mailer } from '../infrastructure/outside.js';
import {
  type Assignment,
  DuplicateValue,
  type PostgresAdmin,
  RecordNotFound,
  type UserFields,
  VersionConflict,
} from '../infrastructure/postgres-admin.js';
import type { PostgresIdentity } from '../infrastructure/postgres-identity.js';
import { randomToken } from '../infrastructure/secrets.js';
import { inviteMail, resetPasswordMail } from './messages.js';

/** Invitations stay valid longer than self-service reset links: people start work on Monday. */
const INVITE_HOURS = 72;
const FORCED_RESET_MINUTES = 24 * 60;
const NO_USER = '00000000-0000-0000-0000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminResult = { ok: true; id: string } | { ok: false; userErrors: UserError[] };

const failed = (...userErrors: UserError[]): AdminResult => ({ ok: false, userErrors });
const fieldError = (
  field: string[],
  message: string,
  code: UserError['code'] = 'VALIDATION_FAILED',
): UserError => ({ code, message, field: ['input', ...field], details: null });

export interface AdminDependencies {
  admin: PostgresAdmin;
  identity: PostgresIdentity;
  guards: AuthGuards;
  mailer: Mailer;
  logger: Logger;
  publicBaseUrl: string;
  accessTtlSeconds: number;
  directory: (organizationId: string) => Promise<Directory>;
}

/** What the acting administrator is: who, and what they may grant. */
export interface Actor {
  principal: Principal;
  grants: Grants;
}

type RoleInput = z.output<typeof setUserRolesInputSchema>['roles'][number];
type KnownRoles = Map<string, { code: string; permissions: string[] }>;

/** User and role administration (SRS §11.2, USR-001…003). */
export class AdminService {
  constructor(private readonly deps: AdminDependencies) {}

  async createUser(actor: Actor, raw: unknown): Promise<AdminResult> {
    const parsed = createUserInputSchema.safeParse(raw);
    if (!parsed.success) return failed(...toUserErrors(parsed.error));
    const input = parsed.data;
    const org = actor.principal.organizationId;

    const fields: UserFields = {
      displayName: input.displayName,
      mobile: input.mobile ?? null,
      employeeCode: input.employeeCode ?? null,
      designationId: input.designationId ?? null,
      departmentId: input.departmentId ?? null,
      primaryLocationId: input.primaryLocationId,
      locationIds: input.additionalLocationIds ?? [],
      deliveryPointCode: input.deliveryPointCode ?? null,
      preferredLocale: input.preferredLocale ?? 'EN',
      reportsToId: input.reportsToId ?? null,
      status: 'INVITED',
    };
    const roleCheck = await this.checkRoles(actor, input.roles, ['roles']);
    const problems = [...(await this.checkReferences(org, fields)), ...roleCheck.problems];
    if (problems.length) return failed(...problems);

    const invite = input.sendInvite
      ? { token: randomToken(), expiresAt: new Date(Date.now() + INVITE_HOURS * 3600_000) }
      : null;
    let userId: string;
    try {
      userId = await this.deps.admin.createUser({
        organizationId: org,
        email: input.email,
        fields,
        assignments: this.assignments(input.roles, fields, roleCheck.known),
        invite,
      });
    } catch (err) {
      if (err instanceof DuplicateValue) return failed(this.duplicate(err));
      throw err;
    }
    if (invite) {
      this.send(
        inviteMail(
          {
            email: input.email,
            displayName: input.displayName,
            locale: fields.preferredLocale === 'HI' ? 'hi' : 'en',
          },
          this.link(invite.token),
          INVITE_HOURS,
        ),
      );
    }
    return { ok: true, id: userId };
  }

  async updateUser(actor: Actor, raw: unknown): Promise<AdminResult> {
    const parsed = updateUserInputSchema.safeParse(raw);
    if (!parsed.success) return failed(...toUserErrors(parsed.error));
    const input = parsed.data;
    const org = actor.principal.organizationId;
    const current = await this.deps.admin.userSnapshot(org, input.id);
    if (!current) return failed(fieldError(['id'], 'validation.notFound', 'NOT_FOUND'));

    // Omitted fields keep their value; null clears optional ones.
    const pick = <K extends keyof UserFields>(key: K, value: UserFields[K] | undefined) =>
      value === undefined ? current[key] : value;
    const fields: UserFields = {
      displayName: pick('displayName', input.displayName),
      mobile: pick('mobile', input.mobile),
      employeeCode: pick('employeeCode', input.employeeCode),
      designationId: pick('designationId', input.designationId),
      departmentId: pick('departmentId', input.departmentId),
      primaryLocationId: pick('primaryLocationId', input.primaryLocationId),
      locationIds: pick('locationIds', input.additionalLocationIds),
      deliveryPointCode: pick('deliveryPointCode', input.deliveryPointCode),
      preferredLocale: pick('preferredLocale', input.preferredLocale),
      reportsToId: pick('reportsToId', input.reportsToId),
      status: pick('status', input.status),
    };

    const problems = await this.checkReferences(org, fields, input.id);
    const blocking = fields.status === 'DISABLED' || fields.status === 'LOCKED';
    if (blocking && current.status !== fields.status) {
      if (input.id === actor.principal.userId) {
        problems.push(fieldError(['status'], 'validation.cannotBlockSelf'));
      } else if (await this.wouldRemoveLastSuperAdmin(org, input.id)) {
        problems.push(fieldError(['status'], 'validation.lastSuperAdmin'));
      }
    }
    if (fields.status === 'INVITED' && current.status !== 'INVITED') {
      problems.push(fieldError(['status'], 'validation.invalidStatus'));
    }
    if (problems.length) return failed(...problems);

    try {
      await this.deps.admin.updateUser({
        organizationId: org,
        userId: input.id,
        expectedVersion: input.expectedVersion,
        fields,
        action:
          fields.status === 'DISABLED' && current.status !== 'DISABLED'
            ? 'USER_DEACTIVATED'
            : 'USER_UPDATED',
      });
    } catch (err) {
      return this.storeFailure(err);
    }
    // AUTH-017: a deactivated or locked user is signed out everywhere at once.
    if (blocking && current.status !== fields.status) {
      const revoked = await this.deps.identity.revokeAllSessions(input.id, `USER_${fields.status}`);
      await this.deps.guards.revoke(revoked, this.deps.accessTtlSeconds);
    }
    return { ok: true, id: input.id };
  }

  async setUserRoles(actor: Actor, raw: unknown): Promise<AdminResult> {
    const parsed = setUserRolesInputSchema.safeParse(raw);
    if (!parsed.success) return failed(...toUserErrors(parsed.error));
    const input = parsed.data;
    const org = actor.principal.organizationId;
    const user = await this.deps.admin.userSnapshot(org, input.userId);
    if (!user) return failed(fieldError(['userId'], 'validation.notFound', 'NOT_FOUND'));

    const { problems, known } = await this.checkRoles(actor, input.roles, ['roles']);
    const keepsSuperAdmin = input.roles.some((r) => known.get(r.roleId)?.code === 'SUPER_ADMIN');
    if (!keepsSuperAdmin && (await this.wouldRemoveLastSuperAdmin(org, input.userId))) {
      problems.push(fieldError(['roles'], 'validation.lastSuperAdmin'));
    }
    if (problems.length) return failed(...problems);

    try {
      await this.deps.admin.setUserRoles({
        organizationId: org,
        userId: input.userId,
        expectedVersion: input.expectedVersion,
        assignments: this.assignments(input.roles, user, known),
      });
    } catch (err) {
      return this.storeFailure(err);
    }
    return { ok: true, id: input.userId };
  }

  async unlockUser(actor: Actor, userId: string): Promise<AdminResult> {
    try {
      await this.deps.admin.unlockUser(actor.principal.organizationId, userId);
    } catch (err) {
      return this.storeFailure(err);
    }
    await this.deps.guards.clearFailures(userId);
    return { ok: true, id: userId };
  }

  /** Sends a reset link and makes the current password temporary (AUTH-013). */
  async forcePasswordReset(actor: Actor, userId: string): Promise<AdminResult> {
    const org = actor.principal.organizationId;
    const user = await this.deps.admin.userSnapshot(org, userId);
    if (!user) return failed(fieldError(['id'], 'validation.notFound', 'NOT_FOUND'));
    const token = randomToken();
    try {
      await this.deps.admin.forcePasswordReset({
        organizationId: org,
        userId,
        token,
        expiresAt: new Date(Date.now() + FORCED_RESET_MINUTES * 60_000),
      });
    } catch (err) {
      return this.storeFailure(err);
    }
    const revoked = await this.deps.identity.revokeAllSessions(userId, 'PASSWORD_RESET_FORCED');
    await this.deps.guards.revoke(revoked, this.deps.accessTtlSeconds);
    this.send(
      resetPasswordMail(
        {
          email: user.email,
          displayName: user.displayName,
          locale: user.preferredLocale === 'HI' ? 'hi' : 'en',
        },
        this.link(token),
        FORCED_RESET_MINUTES,
      ),
    );
    return { ok: true, id: userId };
  }

  async saveRole(actor: Actor, raw: unknown): Promise<AdminResult> {
    const parsed = saveRoleInputSchema.safeParse(raw);
    if (!parsed.success) return failed(...toUserErrors(parsed.error));
    const input = parsed.data;
    const org = actor.principal.organizationId;
    const catalogue = new Set(await this.deps.admin.permissionCatalogue());
    const unknown = input.permissions.filter((p) => !catalogue.has(p));
    if (unknown.length) {
      return failed({
        ...fieldError(['permissions'], 'validation.unknownPermission'),
        details: { unknown },
      });
    }
    // No one builds a role more powerful than their own access.
    const beyond = input.permissions.filter((p) => !actor.grants.can(p));
    if (beyond.length) {
      return failed({
        ...fieldError(['permissions'], 'validation.beyondYourAccess', 'FORBIDDEN'),
        details: { permissions: beyond },
      });
    }
    if (input.id && UUID.test(input.id)) {
      const existing = (await this.deps.admin.roles(org)).find((r) => r.id === input.id);
      if (existing?.code === 'SUPER_ADMIN' && input.permissions.length !== catalogue.size) {
        return failed(fieldError(['permissions'], 'validation.superAdminKeepsAll'));
      }
    }
    try {
      const id = await this.deps.admin.saveRole({
        organizationId: org,
        id: input.id ?? null,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        permissions: [...new Set(input.permissions)],
      });
      return { ok: true, id };
    } catch (err) {
      return this.storeFailure(err);
    }
  }

  // --- helpers ---------------------------------------------------------------------------------

  /** Referenced locations, department, designation and manager must exist in the organisation. */
  private async checkReferences(
    org: string,
    fields: UserFields,
    self?: string,
  ): Promise<UserError[]> {
    const directory = await this.deps.directory(org);
    const problems: UserError[] = [];
    if (fields.primaryLocationId && !directory.location(fields.primaryLocationId)) {
      problems.push(fieldError(['primaryLocationId'], 'validation.notFound'));
    }
    fields.locationIds.forEach((id, i) => {
      if (!directory.location(id))
        problems.push(fieldError(['additionalLocationIds', String(i)], 'validation.notFound'));
    });
    if (fields.departmentId && !directory.department(fields.departmentId)) {
      problems.push(fieldError(['departmentId'], 'validation.notFound'));
    }
    if (fields.designationId && !directory.designation(fields.designationId)) {
      problems.push(fieldError(['designationId'], 'validation.notFound'));
    }
    if (fields.reportsToId) {
      const manager =
        UUID.test(fields.reportsToId) && fields.reportsToId !== self
          ? await this.deps.admin.userSnapshot(org, fields.reportsToId)
          : null;
      if (!manager) problems.push(fieldError(['reportsToId'], 'validation.notFound'));
    }
    return problems;
  }

  /** Roles must exist, scopes must point at real places, and nobody grants beyond their access. */
  private async checkRoles(
    actor: Actor,
    roles: RoleInput[],
    path: string[],
  ): Promise<{ problems: UserError[]; known: KnownRoles }> {
    const org = actor.principal.organizationId;
    const known = await this.deps.admin.rolePermissions(
      org,
      roles.map((r) => r.roleId).filter((id) => UUID.test(id)),
    );
    const directory = await this.deps.directory(org);
    const problems: UserError[] = [];
    roles.forEach((role, i) => {
      const at = [...path, String(i)];
      const found = known.get(role.roleId);
      if (!found) {
        problems.push(fieldError([...at, 'roleId'], 'validation.notFound'));
        return;
      }
      const beyond = found.permissions.filter((p) => !actor.grants.can(p));
      if (beyond.length) {
        problems.push({
          ...fieldError([...at, 'roleId'], 'validation.beyondYourAccess', 'FORBIDDEN'),
          details: { role: found.code, permissions: beyond },
        });
      }
      (role.scopeLocationIds ?? []).forEach((id, j) => {
        if (!directory.location(id))
          problems.push(fieldError([...at, 'scopeLocationIds', String(j)], 'validation.notFound'));
      });
      (role.scopeDepartmentIds ?? []).forEach((id, j) => {
        if (!directory.department(id))
          problems.push(
            fieldError([...at, 'scopeDepartmentIds', String(j)], 'validation.notFound'),
          );
      });
    });
    const ids = roles.map((r) => r.roleId);
    if (new Set(ids).size !== ids.length)
      problems.push(fieldError(path, 'validation.duplicateRole'));
    return { problems, known };
  }

  /**
   * Assignments to store. A store user's role without a location scope gets their own locations:
   * an empty scope would otherwise mean the whole organisation (SRS §10.1, default scope).
   */
  private assignments(
    roles: RoleInput[],
    user: Pick<UserFields, 'primaryLocationId' | 'locationIds'>,
    known: KnownRoles,
  ): Assignment[] {
    const own = [user.primaryLocationId, ...user.locationIds].filter(
      (id, i, all): id is string => !!id && all.indexOf(id) === i,
    );
    return roles.map((role) => {
      const scope = role.scopeLocationIds ?? [];
      const storeRole = known.get(role.roleId)?.code === 'STORE_USER';
      return {
        roleId: role.roleId,
        scopeLocationIds: scope.length || !storeRole ? scope : own,
        scopeDepartmentIds: role.scopeDepartmentIds ?? [],
        scopeCategoryIds: role.scopeCategoryIds ?? [],
        validFrom: role.validFrom ?? null,
        validTo: role.validTo ?? null,
      };
    });
  }

  /** True when this user is the organisation's only active super administrator. */
  private async wouldRemoveLastSuperAdmin(org: string, userId: string): Promise<boolean> {
    const everyone = await this.deps.admin.activeSuperAdmins(org, NO_USER);
    const others = await this.deps.admin.activeSuperAdmins(org, userId);
    return everyone > others && others === 0;
  }

  private duplicate(err: DuplicateValue): UserError {
    const messages: Record<DuplicateValue['field'], string> = {
      email: 'validation.emailTaken',
      employeeCode: 'validation.employeeCodeTaken',
      deliveryPointCode: 'validation.deliveryPointTaken',
      code: 'validation.codeTaken',
    };
    return fieldError([err.field], messages[err.field], 'CONFLICT');
  }

  private storeFailure(err: unknown): AdminResult {
    if (err instanceof DuplicateValue) return failed(this.duplicate(err));
    if (err instanceof VersionConflict) {
      return failed(
        fieldError(['expectedVersion'], 'validation.versionConflict', 'VERSION_CONFLICT'),
      );
    }
    if (err instanceof RecordNotFound)
      return failed(fieldError(['id'], 'validation.notFound', 'NOT_FOUND'));
    throw err;
  }

  private link(token: string): string {
    return `${this.deps.publicBaseUrl.replace(/\/+$/, '')}/reset-password#token=${token}`;
  }

  private send(message: Parameters<Mailer['send']>[0]): void {
    void this.deps.mailer
      .send(message)
      .catch((err: unknown) => this.deps.logger.error({ err }, 'admin e-mail failed'));
  }
}
