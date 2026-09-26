import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocale } from '../../i18n';
import { AuthError, resetPassword } from '../../lib/auth';
import type * as AuthModule from '../../lib/auth';
import { renderScreen } from '../../test/render';
import { ResetPasswordPage } from './ResetPasswordPage';

vi.mock('../../lib/auth', async (original) => ({
  ...(await original<typeof AuthModule>()),
  resetPassword: vi.fn(),
}));

const PASSWORD = 'evening collection at the bmc';

async function choose(newPassword: string, confirmation = newPassword) {
  await userEvent.type(screen.getByLabelText(/^New password/), newPassword);
  await userEvent.type(screen.getByLabelText(/^Repeat the new password/), confirmation);
  await userEvent.click(screen.getByRole('button', { name: 'Save password' }));
}

beforeEach(() => {
  applyLocale('en');
  vi.mocked(resetPassword).mockReset();
  window.location.hash = '#token=abc123';
});

describe('ResetPasswordPage', () => {
  it('takes the token from the link and removes it from the address bar', async () => {
    vi.mocked(resetPassword).mockResolvedValue();
    await renderScreen(() => <ResetPasswordPage />);
    expect(window.location.hash).toBe('');
    await choose(PASSWORD);
    expect(resetPassword).toHaveBeenCalledWith('abc123', PASSWORD);
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been changed');
  });

  it('checks that both entries match before sending', async () => {
    await renderScreen(() => <ResetPasswordPage />);
    await choose(PASSWORD, `${PASSWORD}!`);
    expect(await screen.findByText('The two passwords are not the same.')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('shows the server’s password problems on the field', async () => {
    vi.mocked(resetPassword).mockRejectedValue(
      new AuthError({
        code: 'VALIDATION_FAILED',
        fieldErrors: { newPassword: ['validation.passwordBreached'] },
      }),
    );
    await renderScreen(() => <ResetPasswordPage />);
    await choose(PASSWORD);
    expect(
      await screen.findByText(
        'This password has appeared in a data breach elsewhere. Choose another one.',
      ),
    ).toBeInTheDocument();
  });

  it('offers a new link when this one has expired', async () => {
    vi.mocked(resetPassword).mockRejectedValue(new AuthError({ code: 'AUTH_TOKEN_EXPIRED' }));
    await renderScreen(() => <ResetPasswordPage />);
    await choose(PASSWORD);
    expect(await screen.findByRole('link', { name: 'Ask for a new link' })).toBeInTheDocument();
  });
});
