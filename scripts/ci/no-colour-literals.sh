#!/bin/sh
# SRS §40.2: colour literals are only allowed in packages/design-tokens. Everything else uses the
# tokens (CSS variables / Tailwind token utilities), so themes and contrast stay under control.
set -eu
matches=$(grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(' apps/web/src apps/mobile/src packages/ui/src packages/ui/.storybook \
  --include='*.ts' --include='*.tsx' --include='*.css' \
  | grep -v '/generated/' || true)
if [ -n "$matches" ]; then
  echo "::error::Colour literals found outside packages/design-tokens (use a token instead):"
  echo "$matches"
  exit 1
fi
echo "ok   no colour literals outside the design tokens"
