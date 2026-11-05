// ── ChartFlow Desktop — proceso principal ────────────────────
// Arranca los 5 backends de chart_flow como procesos internos (sin
// consolas ni PowerShell) y muestra todo en una ventana con pestañas.
const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const net = require("net");

// Los backends viven en el repo raiz (modo desarrollo) o en resources/backend (empaquetado)
const BACKEND_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, "backend")
  : path.join(__dirname, "..");

const SERVICES = [
  { name: "backtest", label: "Backtesting", dir: "chartflow-backtest", file: "server.js", port: 8790 },
  { name: "warroom",  label: "War Room / Noticias", dir: "chartflow-backtest/warroom", file: "server.js", port: 3001 },
  { name: "chartflow", label: "ChartFlow multi-chart", dir: "chartflow", file: "server.js", port: 8780 },
  { name: "stock",    label: "Stocks", dir: "stock-dashboard", file: "server.js", port: 8765 },
  { name: "macro",    label: "Dollar / VIX / Bonds", dir: "dollar-vix-bonds-dashboard", file: "server.js", port: 8770 },
];

const children = {};   // name -> child process reference
let win = null;

function portBusy(port) {
  return new Promise(resolve => {
    const s = net.createConnection({ port, host: "127.0.0.1" });
    s.setTimeout(900);
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("timeout", () => { s.destroy(); resolve(false); });
    s.on("error", () => resolve(false));
  });
}

async function ensureService(svc) {
  const up = await portBusy(svc.port);
  if (up) {
    svc.status = "ya corriendo (reutilizado)";
    return svc;
  }
  const cwd = path.join(BACKEND_ROOT, svc.dir);
  const child = spawn(process.execPath, [svc.file], {
    cwd,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: "1" }),
  });
  children[svc.name] = child;
  child.stdout.on("data", d => forward(svc.name, d.toString()));
  child.stderr.on("data", d => forward(svc.name, "[stderr] " + d.toString()));
  child.on("exit", code => forward(svc.name, `[proceso termino: codigo ${code}]`));
  svc.status = "iniciando...";
  return svc;
}

function forward(name, line) {
  const clean = line.trim().slice(0, 160);
  if (!clean) return;
  console.log(`[${name}] ${clean}`);
  if (win && win.webContents && !win.isDestroyed()) {
    win.webContents.send("svc-log", { name, line: clean });
  }
}

async function bootAll() {
  const results = [];
  for (const svc of SERVICES) {
    await ensureService(svc);
    results.push({ name: svc.name, label: svc.label, port: svc.port, status: svc.status });
    sendStatus();
  }
  return results;
}

function sendStatus() {
  const payload = SERVICES.map(s => ({ name: s.name, label: s.label, port: s.port, status: s.status || "-" }));
  if (win && win.webContents && !win.isDestroyed()) win.webContents.send("svc-status", payload);
}

// (re)verificar puertos cada 5 s para actualizar LEDs
setInterval(async () => {
  for (const svc of SERVICES) {
    const up = await portBusy(svc.port);
    const st = up ? "ACTIVO" : (children[svc.name] ? "iniciando..." : "apagado");
    if (svc.status !== st) { svc.status = st; sendStatus(); }
  }
}, 5000);

function createWindow() {
  win = new BrowserWindow({
    width: 1680,
    height: 960,
    minWidth: 1100,
    minHeight: 640,
    backgroundColor: "#0D0E0E",
    autoHideMenuBar: true,
    title: "ChartFlow Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile("home.html");
  win.on("closed", () => { win = null; });
}

ipcMain.handle("services", () => SERVICES.map(s => ({ name: s.name, label: s.label, port: s.port, status: s.status || "-" })));
ipcMain.handle("open-data-dir", () => { try { execSync(`explorer.exe "${path.join(BACKEND_ROOT, "chartflow-backtest", "historical-data")}"`, { shell: "cmd.exe" }); } catch (e) {} });

app.whenReady().then(async () => {
  // puerto de depuracion para agentes/antrenamiento con agent-browser
  app.commandLine.appendSwitch("remote-debugging-port", "9222");
  createWindow();
  await bootAll();
  sendStatus();
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  for (const name of Object.keys(children)) {
    try { children[name].kill(); } catch (e) {}
  }
});
