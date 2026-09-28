import { createFileRoute } from '@tanstack/react-router';
import { VendorPage } from '../../../features/masters/VendorPage';

export const Route = createFileRoute('/_app/masters/vendors/$vendorId')({
  component: function VendorRoute() {
    const { vendorId } = Route.useParams();
    return <VendorPage key={vendorId} vendorId={vendorId} />;
  },
});
