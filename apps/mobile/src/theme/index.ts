import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { TiroDevanagariHindi_400Regular } from '@expo-google-fonts/tiro-devanagari-hindi';
import { type ColorToken, tokens } from '@ie/design-tokens';
import { useColorScheme } from 'react-native';
import { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { useUiStore } from '../stores/ui';

export const FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  TiroDevanagariHindi_400Regular,
};

export type Colors = Record<ColorToken, string>;

/** The token colours for the theme the user picked (or the phone's, for "system"). */
export function useColors(): Colors {
  const preference = useUiStore((s) => s.theme);
  const system = useColorScheme();
  const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return tokens.color[scheme];
}

export function useIsDark(): boolean {
  const preference = useUiStore((s) => s.theme);
  const system = useColorScheme();
  return preference === 'dark' || (preference === 'system' && system === 'dark');
}

/** Mobile type scale (SRS §40.3: body at least 15/22; the phone's text size setting still applies). */
export const TYPE = {
  display: { fontSize: 30, lineHeight: 36 },
  h1: { fontSize: 24, lineHeight: 32 },
  h2: { fontSize: 20, lineHeight: 28 },
  h3: { fontSize: 17, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  bodySm: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
} as const;

export type TypeVariant = keyof typeof TYPE;
export type Weight = 'regular' | 'medium' | 'semibold' | 'bold';

const INTER: Record<Weight, string> = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/**
 * Font for a weight in the current language. Hindi uses Tiro Devanagari Hindi, which has a single
 * weight, so hierarchy comes from size and colour (never synthetic bold) and lines are 15% taller.
 */
export function fontFor(
  locale: 'en' | 'hi',
  weight: Weight,
): { fontFamily: string; lineHeightScale: number } {
  return locale === 'hi'
    ? { fontFamily: 'TiroDevanagariHindi_400Regular', lineHeightScale: 1.15 }
    : { fontFamily: INTER[weight], lineHeightScale: 1 };
}

export const space = tokens.space;
export const radius = tokens.radius;

/** Minimum touch target (SRS §40.6: 48 dp, glove-friendly). */
export const TOUCH_TARGET = 48;

const [x1, y1, x2, y2] = tokens.motion.ease.out;
const easeOut = Easing.bezier(x1, y1, x2, y2);

/**
 * Entrance for a block of content: fade and an 8 dp rise over the token duration, staggered by
 * position. Skipped when the phone asks for reduced motion (SRS §40.5).
 */
export function enter(position = 0) {
  return FadeInDown.duration(tokens.motion.duration.enter)
    .delay(position * 40)
    .easing(easeOut)
    .withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
    .reduceMotion(ReduceMotion.System);
}
