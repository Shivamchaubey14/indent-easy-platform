import { createFileRoute } from '@tanstack/react-router';
import { VendorPage } from '../../../features/masters/VendorPage';

export const Route = createFileRoute('/_app/masters/vendors/new')({
  component: () => <VendorPage />,
});
