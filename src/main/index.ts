import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { findFreePort } from './port-finder'
import { PythonManager } from './python-manager'

let mainWindow: BrowserWindow | null = null
const pythonManager = new PythonManager()
let quitting = false

const registerIpcHandlers = (): void => {
  ipcMain.handle('backend:get-info', () => {
    return {
      status: pythonManager.getStatus(),
      port: pythonManager.getPort(),
      baseUrl: pythonManager.getBaseUrl()
    }
  })

  ipcMain.handle('backend:ping-rest', async () => {
    try {
      const ok = await pythonManager.pingRest()
      return { ok }
    } catch (error) {
      return { ok: false, error: String(error) }
    }
  })

  ipcMain.handle('backend:stop', async () => {
    await pythonManager.stop()
    return { ok: true }
  })
}

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.ieltsmate.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  const port = await findFreePort()
  try {
    await pythonManager.start(port)
  } catch (error) {
    console.error('[main] failed to start backend', error)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  if (quitting) {
    return
  }
  event.preventDefault()
  quitting = true
  void (async () => {
    await pythonManager.stop()
    app.quit()
  })()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
