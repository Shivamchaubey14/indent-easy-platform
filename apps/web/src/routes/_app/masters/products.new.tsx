import { createFileRoute } from '@tanstack/react-router';
import { ProductPage } from '../../../features/masters/ProductPage';

export const Route = createFileRoute('/_app/masters/products/new')({
  component: () => <ProductPage />,
});
