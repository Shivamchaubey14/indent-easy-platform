import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
} from 'react-native';
import { useUiStore } from '../stores/ui';
import { fontFor, radius, space, TOUCH_TARGET, useColors } from '../theme';
import { Text } from './Text';

/** A bordered surface for a group of related content. */
export function Card({ style, ...props }: ViewProps) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: space['4'],
          gap: space['3'],
        },
        style,
      ]}
      {...props}
    />
  );
}

type Tone = 'success' | 'danger' | 'neutral';

const TONE_ICON: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle-outline',
  danger: 'close-circle-outline',
  neutral: 'ellipse-outline',
};

/** Status is colour + icon + text, never colour alone (SRS §40.1). */
export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const colors = useColors();
  const [background, foreground] =
    tone === 'neutral'
      ? [colors['surface-muted'], colors['text-secondary']]
      : [colors[`${tone}-surface`], colors[`${tone}-text`]];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: space['1'],
        backgroundColor: background,
        borderRadius: radius.sm,
        paddingHorizontal: space['2'],
        paddingVertical: 2,
      }}
    >
      <Ionicons name={TONE_ICON[tone]} size={14} color={foreground} accessible={false} />
      <Text variant="caption" weight="medium" style={{ color: foreground }}>
        {children}
      </Text>
    </View>
  );
}

/** A banner for errors and warnings that concern the whole screen. */
export function Banner({
  tone,
  children,
  action,
}: {
  tone: 'danger' | 'warning';
  children: ReactNode;
  action?: ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: colors[`${tone}-surface`],
        borderRadius: radius.md,
        padding: space['4'],
        gap: space['3'],
      }}
    >
      <Text style={{ color: colors[`${tone}-text`] }}>{children}</Text>
      {action}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  block = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** Shows a spinner and ignores presses while an action runs. */
  busy?: boolean;
  /** Full width (forms). */
  block?: boolean;
}) {
  const colors = useColors();
  const [background, foreground] =
    variant === 'primary'
      ? [colors.primary, colors['primary-foreground']]
      : variant === 'secondary'
        ? [colors.secondary, colors['secondary-foreground']]
        : ['transparent', colors.link];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: TOUCH_TARGET,
        flexDirection: 'row',
        gap: space['2'],
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: block ? 'stretch' : 'flex-start',
        paddingHorizontal: space['6'],
        borderRadius: radius.md,
        backgroundColor: background,
        opacity: pressed || busy ? 0.8 : 1,
      })}
    >
      {busy && <ActivityIndicator color={foreground} />}
      <Text weight="semibold" style={{ color: foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Labelled text input with its error below (SRS §41 A11Y-005 on mobile): the label and error are
 * part of the input's accessible description, and "required" is said in words.
 */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  requiredLabel,
  secure = false,
  ...input
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | undefined;
  hint?: string | undefined;
  /** The word for "required", shown after the label. */
  requiredLabel?: string;
  secure?: boolean;
} & Pick<
  TextInputProps,
  | 'autoComplete'
  | 'textContentType'
  | 'keyboardType'
  | 'autoCapitalize'
  | 'onSubmitEditing'
  | 'returnKeyType'
>) {
  const colors = useColors();
  const locale = useUiStore((s) => s.locale);
  const title = requiredLabel ? `${label} (${requiredLabel})` : label;
  return (
    <View style={{ gap: space['1'] }}>
      <Text variant="bodySm" weight="medium">
        {title}
      </Text>
      {hint && (
        <Text variant="caption" color="text-secondary">
          {hint}
        </Text>
      )}
      <TextInput
        accessibilityLabel={title}
        accessibilityHint={error ?? hint}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCorrect={false}
        placeholderTextColor={colors['text-tertiary']}
        style={{
          minHeight: TOUCH_TARGET,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors['border-control'],
          borderRadius: radius.md,
          paddingHorizontal: space['3'],
          backgroundColor: colors['surface-input'],
          color: colors['text-primary'],
          fontFamily: fontFor(locale, 'regular').fontFamily,
          fontSize: 16,
        }}
        {...input}
      />
      {error && (
        <Text variant="bodySm" style={{ color: colors['danger-text'] }} accessibilityRole="alert">
          {error}
        </Text>
      )}
    </View>
  );
}

/** Pick one of a few options (language, theme). Each option is a 48 dp radio button. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string; lang?: string }[];
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: space['2'] }}>
      <Text weight="medium">{label}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          borderWidth: 1,
          borderColor: colors['border-control'],
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLanguage={option.lang}
              onPress={() => onChange(option.value)}
              style={{
                flex: 1,
                minHeight: TOUCH_TARGET,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: selected ? colors.primary : 'transparent',
              }}
            >
              <Text
                weight={selected ? 'semibold' : 'regular'}
                style={{
                  color: selected ? colors['primary-foreground'] : colors['text-secondary'],
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A label and its value on one row. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space['4'] }}>
      <Text color="text-secondary">{label}</Text>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}
