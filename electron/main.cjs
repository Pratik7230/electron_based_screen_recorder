const { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs/promises')

const isDev = !app.isPackaged
let mainWindow
let selectedSourceId = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) mainWindow.loadURL('http://127.0.0.1:5173')
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
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

  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
