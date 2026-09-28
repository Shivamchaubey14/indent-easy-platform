import { createFileRoute } from '@tanstack/react-router';
import { ProductsPage } from '../../../features/masters/ProductsPage';

export const Route = createFileRoute('/_app/masters/products/')({
  component: ProductsPage,
});
