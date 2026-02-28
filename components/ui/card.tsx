import * as React from 'react';
import { Text, View } from 'react-native';
import { TextClassContext } from '~/components/ui/text';
import { TextRef, ViewRef } from '@rn-primitives/types';
import { cn } from '~/lib/utils';

function Card({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof View> & { ref?: React.Ref<ViewRef> }) {
  return (
    <View
      ref={ref}
      className={cn(
        'rounded-3xl border border-border bg-card shadow-sm shadow-foreground/10',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof View> & { ref?: React.Ref<ViewRef> }) {
  return (
    <View
      ref={ref}
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      {...props}
    />
  );
}

function CardTitle({
  className,
  children,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Text> & { ref?: React.Ref<TextRef> }) {
  return (
    <Text
      role='heading'
      aria-level={3}
      ref={ref}
      className={cn(
        'text-md text-primary font-semibold leading-none tracking-wider uppercase',
        className,
      )}
      {...props}
    >
      • {children}
    </Text>
  );
}

function CardDescription({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof Text> & { ref?: React.Ref<TextRef> }) {
  return (
    <Text
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function CardContent({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof View> & { ref?: React.Ref<ViewRef> }) {
  return (
    <TextClassContext.Provider value='text-card-foreground'>
      <View ref={ref} className={cn('p-6 pt-0', className)} {...props} />
    </TextClassContext.Provider>
  );
}

function CardFooter({
  className,
  ref,
  ...props
}: React.ComponentPropsWithoutRef<typeof View> & { ref?: React.Ref<ViewRef> }) {
  return (
    <View
      ref={ref}
      className={cn('flex flex-row items-center p-6 pt-0', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
