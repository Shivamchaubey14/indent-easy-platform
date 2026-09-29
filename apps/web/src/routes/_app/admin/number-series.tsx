import { createFileRoute } from '@tanstack/react-router';
import { NumberSeriesPage } from '../../../features/admin/NumberSeriesPage';

export const Route = createFileRoute('/_app/admin/number-series')({
  component: NumberSeriesPage,
});
