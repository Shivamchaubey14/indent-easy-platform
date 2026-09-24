import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';

export type Locale = 'en' | 'hi';

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
});

/** Switches the UI language and keeps <html lang> in step (fonts and screen readers use it). */
export function applyLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
  document.documentElement.lang = locale;
}

export default i18n;
