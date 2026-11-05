// Puente seguro entre main.js y home.html
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cf", {
  services: () => ipcRenderer.invoke("services"),
  openDataDir: () => ipcRenderer.invoke("open-data-dir"),
  onStatus: (cb) => ipcRenderer.on("svc-status", (e, data) => cb(data)),
  onLog: (cb) => ipcRenderer.on("svc-log", (e, data) => cb(data)),
});
