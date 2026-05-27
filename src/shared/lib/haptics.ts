import { Platform, Vibration } from 'react-native';

const isIOS = Platform.OS === 'ios';

export function hapticLight() {
  if (isIOS) {
    Vibration.vibrate(10);
  } else {
    Vibration.vibrate(20);
  }
}

export function hapticMedium() {
  if (isIOS) {
    Vibration.vibrate(20);
  } else {
    Vibration.vibrate(40);
  }
}

export function hapticHeavy() {
  if (isIOS) {
    Vibration.vibrate(40);
  } else {
    Vibration.vibrate(80);
  }
}

export function hapticSuccess() {
  Vibration.vibrate([0, 30, 10, 20]);
}

export function hapticError() {
  Vibration.vibrate([0, 50, 20, 30, 20, 40]);
}
