import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  Field,
  Loading,
  SelectInput,
  TextInput,
  useToast,
} from '@ie/ui';
import { type SaveProductCategoryFormInput, saveProductCategoryInputSchema } from '@ie/validation';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type PickedUser, UserPicker } from '../../components/UserPicker';
import type { CatalogReferenceQuery } from '../../generated/graphql/graphql';
import { gql } from '../../lib/api';
import { applyUserErrors } from '../../lib/forms';
import { SaveProductCategoryMutation } from './api';
import { QueryError, Th, useCatalogReference, usePermissions } from './shared';

type CategoryRow = CatalogReferenceQuery['productCategories'][number];
const FIELDS = Object.keys(saveProductCategoryInputSchema.shape);

/**
 * Product categories (MST-001, MST-002). A category's owner is the HOD that approval routing falls
 * back to when a product has no owner of its own.
 */
export function CategoriesPage() {
  const { t } = useTranslation();
  const can = usePermissions();
  const reference = useCatalogReference();
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const mayManage = can('admin:master_manage');

  if (reference.isPending) return <Loading />;
  if (reference.isError) {
    return <QueryError error={reference.error} onRetry={() => void reference.refetch()} />;
  }
  const categories = reference.data.productCategories;

  return (
    <section aria-labelledby="categories-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="categories-title" className="text-h2 font-semibold">
          {t('masters.categories')}
        </h2>
        {mayManage && <Button onClick={() => setEditing('new')}>{t('masters.newCategory')}</Button>}
      </div>
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] text-left">
          <thead className="border-b border-border text-body-sm text-text-secondary">
            <tr>
              <Th>{t('admin.code')}</Th>
              <Th>{t('admin.name')}</Th>
              <Th>{t('masters.parentCategory')}</Th>
              <Th>{t('masters.owner')}</Th>
              <Th>{t('masters.inspection')}</Th>
              <Th>
                <span className="sr-only">{t('admin.edit')}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-4 py-3 tabular">{category.code}</td>
                <td className="px-4 py-3">{category.name}</td>
                <td className="px-4 py-3">{category.parent?.name}</td>
                <td className="px-4 py-3">{category.owner?.displayName}</td>
                <td className="px-4 py-3">
                  {category.requiresInspection ? t('masters.yes') : t('masters.no')}
                </td>
                <td className="px-4 py-3 text-right">
                  {mayManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`${t('admin.edit')}: ${category.name}`}
                      onClick={() => setEditing(category)}
                    >
                      {t('admin.edit')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <CategoryDialog
          category={editing === 'new' ? null : editing}
          categories={categories}
          canSearchUsers={can('admin:user_manage')}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function CategoryDialog({
  category,
  categories,
  canSearchUsers,
  onClose,
}: {
  category: CategoryRow | null;
  categories: readonly CategoryRow[];
  canSearchUsers: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<string[]>([]);
  const [owner, setOwner] = useState<PickedUser | null>(category?.owner ?? null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SaveProductCategoryFormInput>({
    resolver: zodResolver(saveProductCategoryInputSchema),
    defaultValues: {
      code: category?.code ?? '',
      name: category?.name ?? '',
      parentId: category?.parent?.id ?? '',
      requiresInspection: category?.requiresInspection ?? false,
    },
  });
  const fieldError = (message?: string) => (message ? t(message) : undefined);

  const save = handleSubmit(async (input) => {
    const result = await gql(SaveProductCategoryMutation, {
      input: { ...input, ownerUserId: owner?.id ?? null, ...(category && { id: category.id }) },
    });
    setProblems(applyUserErrors(t, result.saveProductCategory.userErrors, setError, FIELDS));
    if (result.saveProductCategory.category) {
      toast({ title: t('admin.saved') });
      await queryClient.invalidateQueries({ queryKey: ['masters'] });
      onClose();
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={category ? t('masters.editCategory') : t('masters.newCategory')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('admin.cancel')}
          </Button>
          <Button loading={isSubmitting} onClick={() => void save()}>
            {t('admin.save')}
          </Button>
        </>
      }
    >
      <form noValidate onSubmit={(e) => void save(e)} className="space-y-4">
        {problems.length > 0 && <Alert tone="danger">{problems.join(' ')}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.code')} error={fieldError(errors.code?.message)} required>
            {(c) => <TextInput {...c} {...register('code')} />}
          </Field>
          <Field label={t('admin.name')} error={fieldError(errors.name?.message)} required>
            {(c) => <TextInput {...c} {...register('name')} />}
          </Field>
        </div>
        <Field label={t('masters.parentCategory')} error={fieldError(errors.parentId?.message)}>
          {(c) => (
            <SelectInput {...c} {...register('parentId')}>
              <option value="">{t('admin.none')}</option>
              {categories
                .filter((other) => other.id !== category?.id)
                .map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
            </SelectInput>
          )}
        </Field>
        <Field
          label={t('masters.owner')}
          hint={t('masters.categoryOwnerHint')}
          error={fieldError(errors.ownerUserId?.message)}
        >
          {(c) => (
            <UserPicker control={c} value={owner} onChange={setOwner} canSearch={canSearchUsers} />
          )}
        </Field>
        <Checkbox
          label={t('masters.requiresInspection')}
          description={t('masters.requiresInspectionHint')}
          {...register('requiresInspection')}
        />
      </form>
    </Dialog>
  );
}
