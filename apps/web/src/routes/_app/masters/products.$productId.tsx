import { createFileRoute } from '@tanstack/react-router';
import { ProductPage } from '../../../features/masters/ProductPage';

export const Route = createFileRoute('/_app/masters/products/$productId')({
  component: function ProductRoute() {
    const { productId } = Route.useParams();
    return <ProductPage key={productId} productId={productId} />;
  },
});
