import { createHash } from 'node:crypto';
import type { AppConfig } from '@ie/config';
import { createTransport } from 'nodemailer';
import type { Logger } from '../../../shared/logging.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Outgoing e-mail. SMTP here; Mailpit catches everything locally (http://localhost:8025). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export function smtpMailer(mail: AppConfig['mail']): Mailer {
  const transport = createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.port === 465,
    ...(mail.user && { auth: { user: mail.user, pass: mail.password } }),
  });
  return {
    send: async (message) => {
      await transport.sendMail({ from: mail.from, ...message });
    },
  };
}

/** Whether a password appears in known breaches (AUTH-003). */
export interface BreachedPasswords {
  isBreached(password: string): Promise<boolean>;
}

export const noBreachCheck: BreachedPasswords = { isBreached: () => Promise.resolve(false) };

/**
 * Have I Been Pwned's range API (k-anonymity): only the first five characters of the password's
 * SHA-1 leave the server. If the service can't be reached the password is allowed and the gap is
 * logged; sign-up should not depend on a third party being up.
 */
export function pwnedPasswords(logger: Logger): BreachedPasswords {
  return {
    isBreached: async (password) => {
      const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);
      try {
        const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
          headers: { 'Add-Padding': 'true', 'User-Agent': 'indent-easy' },
          signal: AbortSignal.timeout(3_000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = await response.text();
        return body.split('\n').some((line) => {
          const [candidate, count] = line.trim().split(':');
          return candidate === suffix && Number(count) > 0;
        });
      } catch (err) {
        logger.warn({ err }, 'breached-password check unavailable; password accepted');
        return false;
      }
    },
  };
}
