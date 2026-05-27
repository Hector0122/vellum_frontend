import { NativeModules, Platform } from 'react-native';

const { VellumWidget } = NativeModules;

export const VellumWidgetModule = {
  pushWidgetData: (
    highlightsJson: string,
    bookId: string,
    bookTitle: string,
  ): Promise<boolean> => {
    if (Platform.OS !== 'android' || !VellumWidget) {
      return Promise.reject(new Error('Widget module only available on Android'));
    }
    return VellumWidget.pushWidgetData(highlightsJson, bookId, bookTitle);
  },

  hasWidget: (): Promise<boolean> => {
    if (Platform.OS !== 'android' || !VellumWidget) {
      return Promise.resolve(false);
    }
    return VellumWidget.hasWidget();
  },

  getWidgetBookId: (): Promise<string | null> => {
    if (Platform.OS !== 'android' || !VellumWidget) {
      return Promise.resolve(null);
    }
    return VellumWidget.getWidgetBookId();
  },
};
