import { createFileRoute } from '@tanstack/react-router';
import { FeatureFlagsPage } from '../../../features/admin/FeatureFlagsPage';

export const Route = createFileRoute('/_app/admin/feature-flags')({
  component: FeatureFlagsPage,
});
