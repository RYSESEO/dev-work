import type { CommandCenterApi } from '../../preload';

declare global {
  interface Window {
    commandCenter: CommandCenterApi;
  }
}
