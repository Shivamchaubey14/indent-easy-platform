import type { MailMessage } from '../infrastructure/outside.js';

interface Recipient {
  email: string;
  displayName: string;
  locale: 'en' | 'hi';
}

/** Password reset e-mail in the user's language (AUTH-012). Plain text: it renders everywhere. */
export function resetPasswordMail(to: Recipient, link: string, minutes: number): MailMessage {
  if (to.locale === 'hi') {
    return {
      to: to.email,
      subject: 'इंडेंट ईज़ी: पासवर्ड रीसेट करें',
      text: [
        `नमस्ते ${to.displayName},`,
        '',
        'आपके इंडेंट ईज़ी खाते का पासवर्ड रीसेट करने का अनुरोध मिला है। नया पासवर्ड चुनने के लिए यह लिंक खोलें:',
        link,
        '',
        `यह लिंक ${minutes} मिनट तक और केवल एक बार काम करेगा।`,
        'अगर आपने यह अनुरोध नहीं किया है, तो इस ई-मेल को अनदेखा करें। आपका पासवर्ड नहीं बदलेगा।',
      ].join('\n'),
    };
  }
  return {
    to: to.email,
    subject: 'Indent Easy: reset your password',
    text: [
      `Hello ${to.displayName},`,
      '',
      'We received a request to reset the password of your Indent Easy account. Open this link to choose a new one:',
      link,
      '',
      `The link works once, for ${minutes} minutes.`,
      "If you didn't ask for this, ignore this e-mail. Your password stays the same.",
    ].join('\n'),
  };
}

/** Invitation for a new user to choose their first password (USR-001). */
export function inviteMail(to: Recipient, link: string, hours: number): MailMessage {
  if (to.locale === 'hi') {
    return {
      to: to.email,
      subject: 'इंडेंट ईज़ी: आपका खाता तैयार है',
      text: [
        `नमस्ते ${to.displayName},`,
        '',
        'आपके लिए इंडेंट ईज़ी खाता बनाया गया है। अपना पासवर्ड चुनने के लिए यह लिंक खोलें:',
        link,
        '',
        `यह लिंक ${hours} घंटे तक और केवल एक बार काम करेगा। इसके बाद आप अपने ई-मेल पते से साइन इन कर सकते हैं।`,
      ].join('\n'),
    };
  }
  return {
    to: to.email,
    subject: 'Indent Easy: your account is ready',
    text: [
      `Hello ${to.displayName},`,
      '',
      'An Indent Easy account has been created for you. Open this link to choose your password:',
      link,
      '',
      `The link works once, for ${hours} hours. After that, sign in with your e-mail address.`,
    ].join('\n'),
  };
}
