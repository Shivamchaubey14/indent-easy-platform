import { createFileRoute } from '@tanstack/react-router';
import { ImportsPage } from '../../../features/masters/ImportsPage';

export const Route = createFileRoute('/_app/masters/imports')({
  component: ImportsPage,
});
