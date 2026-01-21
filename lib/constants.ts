export const NAV_THEME = {
  light: {
    background: 'hsl(0 0% 100%)', // background
    border: 'hsl(240 5.9% 90%)', // border
    card: 'hsl(0 0% 100%)', // card
    notification: 'hsl(0 84.2% 60.2%)', // destructive
    primary: 'hsl(240 5.9% 10%)', // primary
    text: 'hsl(240 10% 3.9%)', // foreground
    mutedForeground: 'hsl(240 3.8% 46.1%)', // muted-foreground
  },
  dark: {
    background: 'hsl(234 50% 3%)', // background
    border: 'hsl(240 3.7% 15.9%)', // border
    card: 'hsl(234 7% 10%)', // card
    notification: 'hsl(0 72% 51%)', // destructive
    primary: 'hsl(0 0% 98%)', // primary
    text: 'hsl(0 0% 98%)', // foreground
    mutedForeground: 'hsl(240 5% 50%)', // muted-foreground
  },
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface Theme {
      colors: typeof NAV_THEME.light;
    }
  }
}
