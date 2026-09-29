import { createFileRoute } from '@tanstack/react-router';
import { AuditPage } from '../../../features/admin/AuditPage';

export const Route = createFileRoute('/_app/admin/audit')({
  component: AuditPage,
});
