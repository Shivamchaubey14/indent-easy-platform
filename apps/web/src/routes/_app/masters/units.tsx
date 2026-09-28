import { createFileRoute } from '@tanstack/react-router';
import { UnitsPage } from '../../../features/masters/UnitsPage';

export const Route = createFileRoute('/_app/masters/units')({
  component: UnitsPage,
});
