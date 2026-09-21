const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("movienight", {
  selectFolder: () => ipcRenderer.invoke("movienight:selectFolder"),
  startLocalServer: (dir) => ipcRenderer.invoke("movienight:startLocalServer", dir),
  stopLocalServer: () => ipcRenderer.invoke("movienight:stopLocalServer"),
  openExternal: (url) => ipcRenderer.invoke("movienight:openExternal", url),
  onServerStopped: (cb) => {
    ipcRenderer.on("movienight:serverStopped", () => cb());
  },
});