import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '../../../features/admin/SettingsPage';

export const Route = createFileRoute('/_app/admin/settings')({
  component: SettingsPage,
});
