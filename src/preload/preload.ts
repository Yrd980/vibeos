import { contextBridge, ipcRenderer } from 'electron';
import type { AppEvent, VibeOsApi } from '../shared/types';

const vibeosApi: VibeOsApi = {
  createAppSession(appName) {
    return ipcRenderer.invoke('vibeos:createAppSession', appName);
  },
  sendAppEvent(appSessionId: string, event: AppEvent) {
    return ipcRenderer.invoke('vibeos:sendAppEvent', appSessionId, event);
  },
  closeAppSession(appSessionId: string) {
    return ipcRenderer.invoke('vibeos:closeAppSession', appSessionId);
  }
};

window.addEventListener('beforeunload', () => {
  ipcRenderer.send('vibeos:rendererDestroyed');
});

contextBridge.exposeInMainWorld('vibeos', vibeosApi);
