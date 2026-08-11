import { hues, semantic, hexToRgba } from './tokens';

// primary ('#4A7DB8') ya era exacto a hues.slateBlue — sin cambios. El
// dorado propio (accent/warning, ambos '#D9A441') se unifica al ámbar
// único del sistema (hues.amber === semantic.warning.light). El resto de
// la paleta (bg crema, textos, success/error cálidos, highlighters) es
// una elección deliberada de "papel" propia de Vellum — no un duplicado
// accidental de otra app, así que se queda igual. Ver
// brand-kit/README.md#colores-por-app.
export const colors = {
  background: '#F8F5EF',
  surface: '#FFFFFF',

  primary: hues.slateBlue,
  secondary: '#5D8F74',

  accent: hues.amber,

  text: '#1F2933',
  textSecondary: '#5E5B56',

  border: '#DAD7D0',

  success: '#5D8F74',
  warning: semantic.warning.light,
  error: '#C97A5A',

  highlightYellow: '#F6D365',
  highlightBlue: '#7FB3FF',
  highlightGreen: '#8FD19E',
  highlightPink: '#F5A3B7',
  highlightPurple: '#C6A5FF',

  // Backward-compatible aliases
  bg: '#F8F5EF',
  elevated: '#FFFFFF',
  accentSoft: hexToRgba(hues.amber, 0.12),
  accentActive: '#D08D1E', // ámbar oscurecido ~15% para estado "pressed"
  textPrimary: '#1F2933',
  textMuted: '#9B9790',
  destructive: '#C97A5A',
  white: '#FFFFFF',
  highlightOrange: '#E8A850',

  toastSuccessBg: '#ECF5EF',
  toastErrorBg: '#F9ECEC',
  toastInfoBg: '#EEF1F5',

  streak: '#FF6B35',
  readIndicator: '#10B981',
} as const;

export type ColorKey = keyof typeof colors;
