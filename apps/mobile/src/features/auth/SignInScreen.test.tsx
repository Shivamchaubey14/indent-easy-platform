import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import i18n from '../../i18n';
import { ApiRequestError } from '../../lib/api';
import { signIn } from '../../lib/auth';
import { SignInScreen } from './SignInScreen';

jest.mock('../../lib/auth', () => ({ signIn: jest.fn() }));
jest.mock('expo-router', () => ({ Link: ({ children }: { children: unknown }) => children }));

const signInMock = jest.mocked(signIn);

beforeEach(async () => {
  await i18n.changeLanguage('en');
  signInMock.mockReset();
});

describe('SignInScreen', () => {
  it('checks the fields with the shared rules before calling the server', async () => {
    render(<SignInScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    expect(signInMock).not.toHaveBeenCalled();
  });

  it('signs in with what was typed', async () => {
    signInMock.mockResolvedValue();
    render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText('E-mail or employee code (required)'), ' EMP042 ');
    fireEvent.changeText(screen.getByLabelText('Password (required)'), 'the password');
    fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith({ identifier: 'EMP042', password: 'the password' }),
    );
  });

  it('explains a lockout in the user’s language', async () => {
    await i18n.changeLanguage('hi');
    signInMock.mockRejectedValue(
      new ApiRequestError('locked', 'AUTH_ACCOUNT_LOCKED', 'r1', 423, { retryAfter: 600 }),
    );
    render(<SignInScreen />);
    fireEvent.changeText(screen.getByLabelText('ई-मेल या कर्मचारी कोड (आवश्यक)'), 'a@b.in');
    fireEvent.changeText(screen.getByLabelText('पासवर्ड (आवश्यक)'), 'x');
    fireEvent.press(screen.getByRole('button', { name: 'साइन इन करें' }));
    expect(await screen.findByText(/10 मिनट/)).toBeOnTheScreen();
  });
});
