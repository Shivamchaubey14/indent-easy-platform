import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';
import { useUiStore } from '../stores/ui';
import { type Colors, fontFor, TYPE, type TypeVariant, useColors, type Weight } from '../theme';

export interface TextProps extends NativeTextProps {
  variant?: TypeVariant;
  weight?: Weight;
  color?: keyof Colors;
  /** Aligned digits for quantities, money and codes. */
  tabular?: boolean;
}

/** All app text goes through here, so size, font and colour come from the tokens and the language. */
export function Text({
  variant = 'body',
  weight = 'regular',
  color = 'text-primary',
  tabular = false,
  style,
  ...props
}: TextProps) {
  const colors = useColors();
  const locale = useUiStore((s) => s.locale);
  const { fontFamily, lineHeightScale } = fontFor(locale, weight);
  const { fontSize, lineHeight } = TYPE[variant];
  return (
    <NativeText
      style={[
        {
          fontFamily,
          fontSize,
          lineHeight: Math.round(lineHeight * lineHeightScale),
          color: colors[color],
        },
        tabular && { fontVariant: ['tabular-nums'] },
        style,
      ]}
      {...props}
    />
  );
}
