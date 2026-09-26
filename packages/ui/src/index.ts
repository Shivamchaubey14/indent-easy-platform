// Web component library (SRS §40, §63): accessible Radix primitives styled with the design tokens.
// Import the styles once in the app: `@import '@ie/ui/theme.css';` after `@import 'tailwindcss';`.
export { VisuallyHidden } from 'radix-ui';
export { Alert, ErrorState, type AlertProps, type ErrorStateProps } from './Alert';
export { Button, type ButtonProps, type ButtonSize, type ButtonVariant } from './Button';
export { Card } from './Card';
export { cn } from './cn';
export { Dialog, type DialogProps } from './Dialog';
export { Field, TextInput, type ControlProps, type FieldProps, type TextInputProps } from './Field';
export { Loading, Skeleton } from './Loading';
export { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from './Menu';
export { motion, prefersReducedMotion, useEnter } from './motion';
export { StatusBadge, type StatusBadgeProps } from './StatusBadge';
export { statusesByTone, toneOf, type StatusCode, type Tone } from './status-map';
export { UiStringsProvider, useUiStrings, type UiStrings } from './strings';
export { ToastProvider, useToast, type ToastMessage } from './Toast';
