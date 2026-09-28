import { createFileRoute } from '@tanstack/react-router';
import { VendorsPage } from '../../../features/masters/VendorsPage';

export const Route = createFileRoute('/_app/masters/vendors/')({
  component: VendorsPage,
});
