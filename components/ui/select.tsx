import * as SelectPrimitive from '@rn-primitives/select';
import * as React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Check } from '~/lib/icons/Check';
import { ChevronDown } from '~/lib/icons/ChevronDown';
import { ChevronUp } from '~/lib/icons/ChevronUp';
import { cn } from '~/lib/utils';

export interface SelectProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {}

type Option = SelectPrimitive.Option;

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Value>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Value>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Value
    ref={ref}
    className={cn('text-muted-foreground', className)}
    {...props}
  />
));

type SelectTriggerProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Trigger
> & {
  error?: boolean;
};

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, error, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex flex-row h-10 native:h-12 items-center text-sm justify-between rounded-md border border-input bg-background px-3 py-2 web:ring-offset-background text-muted-foreground web:focus:outline-none web:focus:ring-2 web:focus:ring-ring web:focus:ring-offset-2 [&>span]:line-clamp-1',
      props.disabled && 'web:cursor-not-allowed opacity-50',
      error && 'border-destructive',
      className
    )}
    {...props}
  >
    <>{children}</>
    <ChevronDown
      size={16}
      aria-hidden={true}
      className='text-foreground opacity-50'
    />
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

/**
 * Platform: WEB ONLY
 */
const SelectScrollUpButton = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>) => {
  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn(
        'flex web:cursor-default items-center justify-center py-1',
        className
      )}
      {...props}
    >
      <ChevronUp size={14} className='text-foreground' />
    </SelectPrimitive.ScrollUpButton>
  );
};

/**
 * Platform: WEB ONLY
 */
const SelectScrollDownButton = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>) => {
  if (Platform.OS !== 'web') {
    return null;
  }
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn(
        'flex web:cursor-default items-center justify-center py-1',
        className
      )}
      {...props}
    >
      <ChevronDown size={14} className='text-foreground' />
    </SelectPrimitive.ScrollDownButton>
  );
};

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & {
    portalHost?: string;
  }
>(({ className, children, position = 'popper', portalHost, ...props }, ref) => {
  const { open } = SelectPrimitive.useRootContext();

  return (
    <SelectPrimitive.Portal hostName={portalHost}>
      <SelectPrimitive.Overlay
        style={Platform.OS !== 'web' ? StyleSheet.absoluteFill : undefined}
      >
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <SelectPrimitive.Content
            ref={ref}
            className={cn(
              'relative z-50 max-h-96 min-w-[8rem] rounded-md border border-border bg-popover shadow-md shadow-foreground/10 py-2 px-1 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
              position === 'popper' &&
                'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
              open
                ? 'web:zoom-in-95 web:animate-in web:fade-in-0'
                : 'web:zoom-out-95 web:animate-out web:fade-out-0',
              className
            )}
            position={position}
            {...props}
          >
            <SelectScrollUpButton />
            <View>
              <SelectPrimitive.Viewport
                className={cn(
                  'p-1',
                  position === 'popper' &&
                    'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
                )}
              >
                {children}
              </SelectPrimitive.Viewport>
            </View>
            <SelectScrollDownButton />
          </SelectPrimitive.Content>
        </Animated.View>
      </SelectPrimitive.Overlay>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(
      'py-1.5 native:pb-2 pl-8 native:pl-10 pr-2 text-popover-foreground text-sm native:text-base font-semibold',
      className
    )}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    icon?: React.ReactNode;
    textClassName?: string;
  }
>(({ className, children, icon, textClassName, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative web:group flex flex-row w-full web:cursor-default web:select-none items-center rounded-sm py-1.5 native:py-2 pl-8 native:pl-10 pr-2 web:hover:bg-accent/50 active:bg-accent web:outline-none web:focus:bg-accent',
      props.disabled && 'web:pointer-events-none opacity-50',
      className
    )}
    {...props}
  >
    <View className='absolute left-2 native:left-3.5 flex h-3.5 native:pt-px w-3.5 items-center justify-center'>
      {icon}
      <SelectPrimitive.ItemIndicator>
        <Check size={16} strokeWidth={3} className='text-popover-foreground' />
      </SelectPrimitive.ItemIndicator>
    </View>
    <View className='flex gap-2 flex-row items-center'>
      <SelectPrimitive.ItemText
        className={cn(
          'text-sm native:text-lg text-popover-foreground web:group-focus:text-accent-foreground',
          textClassName
        )}
      />
    </View>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type Option,
};
