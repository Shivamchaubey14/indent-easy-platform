import { createFileRoute } from '@tanstack/react-router';
import { CategoriesPage } from '../../../features/masters/CategoriesPage';

export const Route = createFileRoute('/_app/masters/categories')({
  component: CategoriesPage,
});
