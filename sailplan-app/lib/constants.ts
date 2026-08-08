import { DefaultTheme, Theme } from '@react-navigation/native';

export const NAV_THEME = {
  light: {
    background: 'hsl(196 25% 95%)', // background
    border: 'hsl(196 15% 88%)', // border
    card: 'hsl(0 0% 100%)', // card
    notification: 'hsl(0 84.2% 60.2%)', // destructive
    primary: 'hsl(196 100% 47%)', // primary
    text: 'hsl(240 10% 3.9%)', // foreground
    mutedForeground: 'hsl(240 3.8% 46.1%)', // muted-foreground
  },
  dark: {
    background: 'hsl(234 50% 3%)', // background
    border: 'hsl(240 3.7% 15.9%)', // border
    card: 'hsl(234 7% 10%)', // card
    notification: 'hsl(0 72% 51%)', // destructive
    primary: 'hsl(196 100% 47%)', // primary
    text: 'hsl(0 0% 98%)', // foreground
    mutedForeground: 'hsl(240 5% 50%)', // muted-foreground
  },
};

export const LIGHT_THEME: Theme = {
  dark: false,
  colors: NAV_THEME.light,
  fonts: DefaultTheme.fonts,
};

export const DARK_THEME: Theme = {
  dark: true,
  colors: NAV_THEME.dark,
  fonts: DefaultTheme.fonts,
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface Theme {
      colors: typeof NAV_THEME.light;
    }
  }
}
