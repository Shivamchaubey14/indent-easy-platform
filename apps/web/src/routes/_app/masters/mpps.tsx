import { createFileRoute } from '@tanstack/react-router';
import { MppsPage } from '../../../features/masters/MppsPage';

export const Route = createFileRoute('/_app/masters/mpps')({
  component: MppsPage,
});
