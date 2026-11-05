// Puente seguro entre main.js y home.html
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cf", {
  services: () => ipcRenderer.invoke("services"),
  openDataDir: () => ipcRenderer.invoke("open-data-dir"),
  activate: (name) => ipcRenderer.send("activate-pane", name),
  saveConfig: () => ipcRenderer.invoke("save-config"),
  onStatus: (cb) => ipcRenderer.on("svc-status", (e, data) => cb(data)),
  onLog: (cb) => ipcRenderer.on("svc-log", (e, data) => cb(data)),
});
