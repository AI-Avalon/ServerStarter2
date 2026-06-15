import { api } from 'app/src-electron/core/api';
import { onReadyWindow } from '../lifecycle/lifecycle';
import { ErrorMessage } from '../schema/error';
import { OsPlatform } from '../schema/os';

/** linuxの最新版があることをwindowが生成されてから通知 */
export const notifyUpdate = async (
  type: OsPlatform,
  systemVersion: string
): Promise<void> => {
  onReadyWindow(() => api.send.NotifySystemUpdate(type, systemVersion), true);
};

export const notifyUpdateError = async (
  error: ErrorMessage
): Promise<void> => {
  onReadyWindow(() => api.send.Error(error), true);
};
