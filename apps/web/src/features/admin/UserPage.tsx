import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dialog,
  ErrorState,
  Field,
  Loading,
  SelectInput,
  StatusBadge,
  TextInput,
  useToast,
} from '@ie/ui';
import { createUserInputSchema } from '@ie/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { z } from 'zod';
import { ApiRequestError, gql } from '../../lib/api';
import {
  CreateUserMutation,
  ForcePasswordResetMutation,
  SetUserRolesMutation,
  UnlockUserMutation,
  UpdateUserMutation,
  userQuery,
} from './api';
import { type AssignmentDraft, RolesEditor, toAssignmentInput } from './RolesEditor';
import { applyUserErrors, statusTone, useReferenceData } from './shared';

const profileSchema = createUserInputSchema.pick({
  email: true,
  displayName: true,
  mobile: true,
  employeeCode: true,
  designationId: true,
  departmentId: true,
  primaryLocationId: true,
  additionalLocationIds: true,
  deliveryPointCode: true,
  preferredLocale: true,
});
type ProfileForm = z.input<typeof profileSchema>;
const PROFILE_FIELDS = Object.keys(profileSchema.shape);

/** Each language is named in its own script, whatever the current UI language. */
const LANGUAGES = [
  ['EN', 'English', 'en'],
  ['HI', 'हिन्दी', 'hi'],
] as const;

type UserData = NonNullable<
  Awaited<ReturnType<NonNullable<ReturnType<typeof userQuery>['queryFn']>>>
>;

/** Create (no userId) or edit a user. */
export function UserPage({ userId }: { userId?: string }) {
  const user = useQuery({ ...userQuery(userId ?? ''), enabled: !!userId });
  const reference = useReferenceData();
  if ((userId && user.isPending) || reference.isPending) return <Loading />;
  if (user.isError || reference.isError) {
    const error = user.error ?? reference.error;
    return (
      <ErrorState
        requestId={error instanceof ApiRequestError ? error.requestId : undefined}
        onRetry={() => void Promise.all([user.refetch(), reference.refetch()])}
      />
    );
  }
  return <UserForm key={user.data?.version ?? 'new'} user={user.data ?? null} />;
}

function UserForm({ user }: { user: UserData | null }) {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reference = useReferenceData();
  const data = reference.data!;
  const [general, setGeneral] = useState<string[]>([]);
  const [roles, setRoles] = useState<AssignmentDraft[]>(
    user?.roles.map((r) => ({
      roleId: r.role.id,
      scopeLocationIds: r.scopeLocations.map((l) => l.id),
      scopeDepartmentIds: r.scopeDepartments.map((d) => d.id),
      validFrom: r.validFrom ?? '',
      validTo: r.validTo ?? '',
    })) ?? [],
  );
  const [roleErrors, setRoleErrors] = useState<Record<number, string>>({});
  const [sendInvite, setSendInvite] = useState(true);
  const [confirm, setConfirm] = useState<'deactivate' | 'reset' | null>(null);
  const [busy, setBusy] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    mode: 'onBlur',
    defaultValues: {
      email: user?.email ?? '',
      displayName: user?.displayName ?? '',
      mobile: user?.mobile ?? '',
      employeeCode: user?.employeeCode ?? '',
      designationId: user?.designation?.id ?? '',
      departmentId: user?.department?.id ?? '',
      primaryLocationId: user?.primaryLocation?.id ?? '',
      additionalLocationIds:
        user?.locations.filter((l) => l.id !== user.primaryLocation?.id).map((l) => l.id) ?? [],
      deliveryPointCode: user?.deliveryPointCode ?? '',
      preferredLocale: user?.preferredLocale ?? 'EN',
    },
  });
  const additional = useWatch({ control, name: 'additionalLocationIds' }) ?? [];
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  /** Role errors come back as ["input", "roles", "2", "roleId"]; show them on that assignment. */
  const splitRoleErrors = (userErrors: { message: string; field?: string[] | null }[]) => {
    const byIndex: Record<number, string> = {};
    const rest = userErrors.filter((e) => {
      if (e.field?.[1] !== 'roles') return true;
      const index = Number(e.field[2]);
      if (Number.isInteger(index)) byIndex[index] = t(e.message);
      else setGeneral((g) => [...g, t(e.message)]);
      return false;
    });
    setRoleErrors(byIndex);
    return rest;
  };

  const save = handleSubmit(async (profile) => {
    setGeneral([]);
    setRoleErrors({});
    const common = {
      displayName: profile.displayName,
      mobile: profile.mobile || null,
      employeeCode: profile.employeeCode || null,
      designationId: profile.designationId || null,
      departmentId: profile.departmentId || null,
      primaryLocationId: profile.primaryLocationId,
      additionalLocationIds: profile.additionalLocationIds ?? [],
      deliveryPointCode: profile.deliveryPointCode || null,
      preferredLocale: profile.preferredLocale ?? 'EN',
    };
    if (!user) {
      const result = await gql(CreateUserMutation, {
        input: { ...common, email: profile.email, roles: roles.map(toAssignmentInput), sendInvite },
      });
      const problems = splitRoleErrors(result.createUser.userErrors);
      setGeneral((g) => [...g, ...applyUserErrors(t, problems, setError, PROFILE_FIELDS)]);
      if (result.createUser.user) {
        toast({ title: sendInvite ? t('admin.userCreated') : t('admin.userCreatedNoInvite') });
        await refresh();
        await navigate({
          to: '/admin/users/$userId',
          params: { userId: result.createUser.user.id },
        });
      }
      return;
    }
    const result = await gql(UpdateUserMutation, {
      input: { ...common, id: user.id, expectedVersion: user.version },
    });
    setGeneral(applyUserErrors(t, result.updateUser.userErrors, setError, PROFILE_FIELDS));
    if (result.updateUser.user) {
      toast({ title: t('admin.saved') });
      await refresh();
    }
  });

  const saveRoles = async () => {
    if (!user) return;
    setBusy(true);
    setGeneral([]);
    try {
      const result = await gql(SetUserRolesMutation, {
        input: {
          userId: user.id,
          expectedVersion: user.version,
          roles: roles.map(toAssignmentInput),
        },
      });
      setGeneral(applyUserErrors(t, splitRoleErrors(result.setUserRoles.userErrors)));
      if (result.setUserRoles.user) {
        toast({ title: t('admin.rolesSaved') });
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: 'deactivate' | 'reactivate' | 'unlock' | 'reset') => {
    if (!user) return;
    setBusy(true);
    setGeneral([]);
    try {
      let userErrors: { message: string; field?: string[] | null }[] = [];
      if (action === 'unlock') {
        userErrors = (await gql(UnlockUserMutation, { id: user.id })).unlockUser.userErrors;
      } else if (action === 'reset') {
        userErrors = (await gql(ForcePasswordResetMutation, { id: user.id })).forcePasswordReset
          .userErrors;
      } else {
        userErrors = (
          await gql(UpdateUserMutation, {
            input: {
              id: user.id,
              expectedVersion: user.version,
              status: action === 'deactivate' ? 'DISABLED' : 'ACTIVE',
            },
          })
        ).updateUser.userErrors;
      }
      setGeneral(applyUserErrors(t, userErrors));
      if (userErrors.length === 0) {
        const done = {
          deactivate: 'deactivated',
          reactivate: 'reactivated',
          unlock: 'unlocked',
          reset: 'resetSent',
        };
        toast({ title: t(`admin.${done[action]}`) });
        await refresh();
      }
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const locationName = (id: string) => data.locations.find((l) => l.id === id)?.name ?? '';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-h2 font-semibold">{user?.displayName ?? t('admin.createUserTitle')}</h2>
        {user && (
          <StatusBadge tone={statusTone(user.status)}>{t(`userStatus.${user.status}`)}</StatusBadge>
        )}
      </div>
      {general.length > 0 && (
        <Alert tone="danger">
          {general.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </Alert>
      )}

      <form noValidate onSubmit={(e) => void save(e)} className="space-y-6">
        <Card aria-labelledby="profile-title" className="space-y-4">
          <h3 id="profile-title" className="text-h3 font-semibold">
            {t('admin.profile')}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t('admin.email')} error={fieldError(errors.email?.message)} required>
              {(control) => (
                <TextInput {...control} type="email" readOnly={!!user} {...register('email')} />
              )}
            </Field>
            <Field
              label={t('admin.displayName')}
              error={fieldError(errors.displayName?.message)}
              required
            >
              {(control) => <TextInput {...control} {...register('displayName')} />}
            </Field>
            <Field
              label={t('admin.mobile')}
              hint={t('admin.mobileHint')}
              error={fieldError(errors.mobile?.message)}
            >
              {(control) => <TextInput {...control} type="tel" {...register('mobile')} />}
            </Field>
            <Field label={t('admin.employeeCode')} error={fieldError(errors.employeeCode?.message)}>
              {(control) => <TextInput {...control} {...register('employeeCode')} />}
            </Field>
            <Field
              label={t('admin.primaryLocation')}
              error={fieldError(errors.primaryLocationId?.message)}
              required
            >
              {(control) => (
                <SelectInput {...control} {...register('primaryLocationId')}>
                  <option value="">{t('admin.choose')}</option>
                  {data.locations
                    .filter((l) => l.active)
                    .map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.code})
                      </option>
                    ))}
                </SelectInput>
              )}
            </Field>
            <Field label={t('admin.department')} error={fieldError(errors.departmentId?.message)}>
              {(control) => (
                <SelectInput {...control} {...register('departmentId')}>
                  <option value="">{t('admin.none')}</option>
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field label={t('admin.designation')} error={fieldError(errors.designationId?.message)}>
              {(control) => (
                <SelectInput {...control} {...register('designationId')}>
                  <option value="">{t('admin.none')}</option>
                  {data.designations.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Field
              label={t('admin.deliveryPointCode')}
              error={fieldError(errors.deliveryPointCode?.message)}
            >
              {(control) => <TextInput {...control} {...register('deliveryPointCode')} />}
            </Field>
            <Field label={t('admin.language')}>
              {(control) => (
                <SelectInput {...control} {...register('preferredLocale')}>
                  {LANGUAGES.map(([value, label, lang]) => (
                    <option key={value} value={value} lang={lang}>
                      {label}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-body-sm font-medium">{t('admin.additionalLocations')}</legend>
            <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
              {data.locations
                .filter((l) => l.active)
                .map((l) => (
                  <Checkbox
                    key={l.id}
                    label={`${l.name} (${l.code})`}
                    checked={additional.includes(l.id)}
                    onChange={() =>
                      setValue(
                        'additionalLocationIds',
                        additional.includes(l.id)
                          ? additional.filter((id) => id !== l.id)
                          : [...additional, l.id],
                      )
                    }
                  />
                ))}
            </div>
            {additional.length > 0 && (
              <p className="text-caption text-text-secondary">
                {additional.map(locationName).join(', ')}
              </p>
            )}
          </fieldset>
          {user && (
            <Button type="submit" loading={isSubmitting}>
              {t('admin.save')}
            </Button>
          )}
        </Card>

        <Card aria-labelledby="roles-title" className="space-y-4">
          <h3 id="roles-title" className="text-h3 font-semibold">
            {t('admin.roleAssignments')}
          </h3>
          <RolesEditor
            value={roles}
            onChange={setRoles}
            roles={data.roles}
            locations={data.locations.filter((l) => l.active)}
            departments={data.departments}
            errors={roleErrors}
          />
          {user ? (
            <Button onClick={() => void saveRoles()} loading={busy}>
              {t('admin.saveRoles')}
            </Button>
          ) : (
            <>
              <Checkbox
                label={t('admin.sendInvite')}
                description={t('admin.sendInviteHint')}
                checked={sendInvite}
                onChange={(e) => setSendInvite(e.target.checked)}
              />
              <Button type="submit" loading={isSubmitting}>
                {t('admin.createUser')}
              </Button>
            </>
          )}
        </Card>
      </form>

      {user && (
        <Card aria-labelledby="actions-title" className="space-y-4">
          <h3 id="actions-title" className="text-h3 font-semibold">
            {t('admin.actions')}
          </h3>
          <div className="flex flex-wrap gap-3">
            {user.status === 'DISABLED' ? (
              <Button variant="secondary" onClick={() => void act('reactivate')} disabled={busy}>
                {t('admin.reactivate')}
              </Button>
            ) : (
              <Button variant="danger" onClick={() => setConfirm('deactivate')} disabled={busy}>
                {t('admin.deactivate')}
              </Button>
            )}
            <Button variant="secondary" onClick={() => void act('unlock')} disabled={busy}>
              {t('admin.unlock')}
            </Button>
            <Button variant="secondary" onClick={() => setConfirm('reset')} disabled={busy}>
              {t('admin.forceReset')}
            </Button>
          </div>
        </Card>
      )}

      {user && (
        <Dialog
          open={confirm !== null}
          onOpenChange={(open) => !open && setConfirm(null)}
          title={
            confirm === 'reset'
              ? t('admin.forceResetConfirm', { name: user.displayName })
              : t('admin.deactivateConfirm', { name: user.displayName })
          }
          description={
            confirm === 'reset'
              ? t('admin.forceResetConfirmBody')
              : t('admin.deactivateConfirmBody')
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                {t('admin.cancel')}
              </Button>
              <Button
                variant={confirm === 'reset' ? 'primary' : 'danger'}
                loading={busy}
                onClick={() => void act(confirm === 'reset' ? 'reset' : 'deactivate')}
              >
                {confirm === 'reset' ? t('admin.forceReset') : t('admin.deactivate')}
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
