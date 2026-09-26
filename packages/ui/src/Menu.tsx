import { DropdownMenu } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from './cn';

/*
 * A menu of actions opened from a button, e.g. a page's secondary actions (SRS §40.4). Radix
 * handles the keyboard (arrows, typeahead, Esc) and focus.
 *
 *   <Menu>
 *     <MenuTrigger asChild><Button variant="ghost">…</Button></MenuTrigger>
 *     <MenuContent>
 *       <MenuItem onSelect={…}>…</MenuItem>
 *     </MenuContent>
 *   </Menu>
 */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  sideOffset = 4,
  align = 'end',
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 min-w-48 rounded-md border border-border bg-surface p-1 text-text-primary',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  className,
  tone = 'default',
  ...props
}: ComponentProps<typeof DropdownMenu.Item> & { tone?: 'default' | 'danger' }) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex h-9 cursor-default items-center gap-2 rounded-sm px-3 text-body outline-none select-none',
        'data-disabled:text-disabled-text data-highlighted:bg-surface-muted',
        tone === 'danger' && 'text-danger-text',
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn('my-1 h-px bg-border', className)} {...props} />;
}
