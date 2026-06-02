export const colors = {
  background: '#F8F5EF',
  surface: '#FFFFFF',

  primary: '#4A7DB8',
  secondary: '#5D8F74',

  accent: '#D9A441',

  text: '#1F2933',
  textSecondary: '#5E5B56',

  border: '#DAD7D0',

  success: '#5D8F74',
  warning: '#D9A441',
  error: '#C97A5A',

  highlightYellow: '#F6D365',
  highlightBlue: '#7FB3FF',
  highlightGreen: '#8FD19E',
  highlightPink: '#F5A3B7',
  highlightPurple: '#C6A5FF',

  // Backward-compatible aliases
  bg: '#F8F5EF',
  elevated: '#FFFFFF',
  accentSoft: 'rgba(217, 164, 65, 0.12)',
  accentActive: '#C6953A',
  textPrimary: '#1F2933',
  textMuted: '#9B9790',
  destructive: '#C97A5A',
  white: '#FFFFFF',
  highlightOrange: '#E8A850',

  toastSuccessBg: '#ECF5EF',
  toastErrorBg: '#F9ECEC',
  toastInfoBg: '#EEF1F5',
} as const;

export type ColorKey = keyof typeof colors;
