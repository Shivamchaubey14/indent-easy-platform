import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyLocale } from '../../i18n';
import { LoginPage } from './LoginPage';

beforeEach(() => applyLocale('en'));

describe('LoginPage', () => {
  it('shows field errors from the shared validation rules', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(screen.getByLabelText('E-mail address')).toHaveAttribute('aria-invalid', 'true');
  });

  it('rejects an invalid e-mail address', async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText('E-mail address'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid e-mail address.')).toBeInTheDocument();
  });

  it('switches to Hindi, including validation messages', async () => {
    render(<LoginPage />);
    await userEvent.click(screen.getByRole('button', { name: 'हिं' }));
    expect(document.documentElement.lang).toBe('hi');
    await userEvent.click(screen.getByRole('button', { name: 'साइन इन करें' }));
    expect(await screen.findAllByText('यह फ़ील्ड आवश्यक है।')).toHaveLength(2);
  });

  it('explains that sign-in is not available yet, without sending anything', async () => {
    render(<LoginPage />);
    await userEvent.type(screen.getByLabelText('E-mail address'), 'store@shwetdhara.in');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Sign-in is being built');
  });
});
