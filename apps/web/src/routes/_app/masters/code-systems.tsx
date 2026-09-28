import { createFileRoute } from '@tanstack/react-router';
import { CodeSystemsPage } from '../../../features/masters/CodeSystemsPage';

export const Route = createFileRoute('/_app/masters/code-systems')({
  component: CodeSystemsPage,
});
