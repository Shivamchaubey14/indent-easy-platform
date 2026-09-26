import { Button, Card, Checkbox, Field, SelectInput, TextInput } from '@ie/ui';
import { useTranslation } from 'react-i18next';
import { roleName } from './shared';

export interface AssignmentDraft {
  roleId: string;
  scopeLocationIds: string[];
  scopeDepartmentIds: string[];
  validFrom: string;
  validTo: string;
}

interface Option {
  id: string;
  code?: string;
  name: string;
}

export const emptyAssignment = (): AssignmentDraft => ({
  roleId: '',
  scopeLocationIds: [],
  scopeDepartmentIds: [],
  validFrom: '',
  validTo: '',
});

/** Draft → the contract's RoleAssignmentInput (blank dates dropped). */
export const toAssignmentInput = (a: AssignmentDraft) => ({
  roleId: a.roleId,
  scopeLocationIds: a.scopeLocationIds,
  scopeDepartmentIds: a.scopeDepartmentIds,
  ...(a.validFrom && { validFrom: a.validFrom }),
  ...(a.validTo && { validTo: a.validTo }),
});

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

/**
 * Role assignments with their scope (USR-002). No locations ticked means the whole organisation;
 * the server gives a store user their own locations in that case.
 */
export function RolesEditor({
  value,
  onChange,
  roles,
  locations,
  departments,
  errors,
}: {
  value: AssignmentDraft[];
  onChange: (value: AssignmentDraft[]) => void;
  roles: readonly (Option & { code: string })[];
  locations: readonly Option[];
  departments: readonly Option[];
  /** Messages for an assignment, by index. */
  errors?: Record<number, string>;
}) {
  const { t } = useTranslation();
  const update = (index: number, patch: Partial<AssignmentDraft>) =>
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)));

  return (
    <div className="space-y-4">
      {value.map((assignment, index) => (
        <Card key={index} className="space-y-4 p-4" aria-label={t('admin.role')}>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={t('admin.role')} error={errors?.[index]} required>
              {(control) => (
                <SelectInput
                  {...control}
                  value={assignment.roleId}
                  onChange={(e) => update(index, { roleId: e.target.value })}
                >
                  <option value="">{t('admin.choose')}</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {roleName(t, role)}
                    </option>
                  ))}
                </SelectInput>
              )}
            </Field>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              {t('admin.removeRole')}
            </Button>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-body-sm font-medium">{t('admin.scopeLocations')}</legend>
            <p className="text-caption text-text-secondary">{t('admin.scopeLocationsHint')}</p>
            <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
              {locations.map((location) => (
                <Checkbox
                  key={location.id}
                  label={`${location.name} (${location.code ?? ''})`}
                  checked={assignment.scopeLocationIds.includes(location.id)}
                  onChange={() =>
                    update(index, {
                      scopeLocationIds: toggle(assignment.scopeLocationIds, location.id),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
          {departments.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-medium">{t('admin.scopeDepartments')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {departments.map((department) => (
                  <Checkbox
                    key={department.id}
                    label={department.name}
                    checked={assignment.scopeDepartmentIds.includes(department.id)}
                    onChange={() =>
                      update(index, {
                        scopeDepartmentIds: toggle(assignment.scopeDepartmentIds, department.id),
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('admin.validFrom')}>
              {(control) => (
                <TextInput
                  {...control}
                  type="date"
                  value={assignment.validFrom}
                  onChange={(e) => update(index, { validFrom: e.target.value })}
                />
              )}
            </Field>
            <Field label={t('admin.validTo')}>
              {(control) => (
                <TextInput
                  {...control}
                  type="date"
                  value={assignment.validTo}
                  onChange={(e) => update(index, { validTo: e.target.value })}
                />
              )}
            </Field>
          </div>
        </Card>
      ))}
      <Button variant="secondary" size="sm" onClick={() => onChange([...value, emptyAssignment()])}>
        {t('admin.addRole')}
      </Button>
    </div>
  );
}
