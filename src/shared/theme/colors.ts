export const colors = {
  bg: '#0D0D14',
  surface: '#181820',
  elevated: '#22222E',
  accent: '#6C63FF',
  accentSoft: 'rgba(108, 99, 255, 0.12)',
  accentActive: '#5A52E0',
  textPrimary: '#EEEEF4',
  textSecondary: '#9494AA',
  textMuted: '#555568',
  border: '#2A2A38',
  destructive: '#FF6B6B',
  error: '#EF4444',
  success: '#34D399',

  white: '#FFFFFF',

  highlightYellow: '#FFD700',
  highlightGreen: '#34D399',
  highlightBlue: '#4A7CFF',
  highlightPink: '#FF6B9D',
  highlightOrange: '#FFAA00',

  toastSuccessBg: '#0D1F17',
  toastErrorBg: '#1F1111',
  toastInfoBg: '#11112B',
} as const;

export type ColorKey = keyof typeof colors;
