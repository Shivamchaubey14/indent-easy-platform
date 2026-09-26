import { createFileRoute } from '@tanstack/react-router';
import { LocationsPage } from '../../../features/admin/LocationsPage';

export const Route = createFileRoute('/_app/admin/locations')({
  component: LocationsPage,
});
