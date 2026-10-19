const { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog, shell, screen } = require('electron')
const path = require('path')
const fs = require('fs/promises')

const isDev = !app.isPackaged
let mainWindow = null
let widget = null
let widgetState = { phase: 'countdown', elapsed: 0, count: 5 }
let selectedSourceId = null

const webPrefs = {
  preload: path.join(__dirname, 'preload.cjs'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}

function loadApp(win, hash) {
  if (isDev) win.loadURL(`http://127.0.0.1:5173/${hash ? '#/' + hash : ''}`)
  else win.loadFile(path.join(__dirname, '../dist/index.html'), hash ? { hash: '/' + hash } : undefined)
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    webPreferences: { ...webPrefs, backgroundThrottling: false }, // keep timers accurate while minimized
  })
  loadApp(mainWindow)
  mainWindow.on('closed', () => {
    mainWindow = null
    closeWidget()
  })
}

function createWidget() {
  if (widget) return
  const { workArea } = screen.getPrimaryDisplay()
  const w = 300
  const h = 64
  widget = new BrowserWindow({
    width: w,
    height: h,
    x: Math.round(workArea.x + (workArea.width - w) / 2),
    y: workArea.y + 12,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#14171d',
    webPreferences: { ...webPrefs, backgroundThrottling: false },
  })
  widget.setAlwaysOnTop(true, 'screen-saver')
  widget.setContentProtection(true) // hides the widget from screen capture on Windows
  loadApp(widget, 'widget')
  widget.webContents.on('did-finish-load', () => {
    widget?.webContents.send('widget-state', widgetState)
    widget?.show()
  })
  widget.on('closed', () => {
    widget = null
  })
}

function closeWidget() {
  if (widget && !widget.isDestroyed()) widget.close()
  widget = null
}

app.whenReady().then(() => {
  // Lets the renderer call getDisplayMedia() with the source chosen in our own UI,
  // and captures system audio (WASAPI loopback) on Windows.
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'] })
      const source =
        sources.find((s) => s.id === selectedSourceId) ||
        sources.find((s) => s.id.startsWith('screen:'))
      if (!source) return callback({})
      callback({ video: source, ...(request.audioRequested && { audio: 'loopback' }) })
    },
    { useSystemPicker: false }
  )

  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    })
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: s.thumbnail.toDataURL(),
    }))
  })

  ipcMain.handle('select-source', (_e, id) => {
    selectedSourceId = id
  })

  // Widget: show it (and minimize the main window), or close it (and restore the main window)
  ipcMain.handle('show-widget', () => {
    widgetState = { phase: 'countdown', elapsed: 0, count: 5 }
    createWidget()
    mainWindow?.minimize()
  })

  ipcMain.handle('hide-widget', () => {
    closeWidget()
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })

  // Main window -> widget (state: phase, elapsed, count)
  ipcMain.on('widget-update', (_e, state) => {
    widgetState = state
    if (widget && !widget.webContents.isLoading()) widget.webContents.send('widget-state', state)
  })

  // Widget -> main window (actions: 'pause' | 'stop' | 'cancel')
  ipcMain.on('widget-action', (_e, action) => {
    mainWindow?.webContents.send('widget-action', action)
  })

  ipcMain.handle('save-recording', async (_e, arrayBuffer) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save recording',
      defaultPath: path.join(app.getPath('videos'), `recording-${stamp}.webm`),
      filters: [{ name: 'WebM video', extensions: ['webm'] }],
    })
    if (canceled || !filePath) return null
    await fs.writeFile(filePath, Buffer.from(arrayBuffer))
    return filePath
  })

  ipcMain.handle('show-in-folder', (_e, filePath) => shell.showItemInFolder(filePath))

  createMainWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})