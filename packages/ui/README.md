# @ie/ui

The web component library: accessible [Radix](https://www.radix-ui.com/) primitives styled with
the design tokens (`@ie/design-tokens`). Motion uses GSAP with the motion tokens and respects
reduced motion.

## Using it

```css
/* the app's stylesheet */
@import 'tailwindcss';
@import '@ie/ui/theme.css';
```

```tsx
<UiStringsProvider strings={stringsFromI18n}>
  <ToastProvider>
    <App />
  </ToastProvider>
</UiStringsProvider>
```

The components take all visible text as props. The few words they say themselves (close,
loading, required, ...) come from `UiStringsProvider`, so they follow the user's language.

| Component                         | Notes                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| `Button`                          | `primary`, `secondary`, `ghost`, `danger`; `loading` blocks clicks      |
| `Card`                            | Give it `aria-labelledby` its heading                                   |
| `StatusBadge`                     | Colour + icon + text. Pass a status code; the tone comes from the map   |
| `Alert`, `ErrorState`             | Errors announce at once; other tones politely                           |
| `Loading`, `Skeleton`             | No shimmer under reduced motion                                         |
| `Field`, `TextInput`              | Label, "required" in words, hint and error linked with aria-describedby |
| `Dialog`                          | Controlled; focus trapped, Esc closes, focus returns to the opener      |
| `Menu`, `MenuContent`, `MenuItem` | Action menus with keyboard support                                      |
| `ToastProvider`, `useToast`       | Confirmations only; errors that need action stay inline                 |
| `useEnter`                        | Page entrance animation                                                 |

`src/status-map.ts` decides the tone of every workflow status. Its test fails if the database
allows a status that isn't listed there.

## Developing

```sh
pnpm ui:storybook                        # http://localhost:6006, with theme and language toolbars
pnpm --filter @ie/ui test                # component tests, including axe accessibility checks
pnpm --filter @ie/ui build-storybook     # what CI runs
```
