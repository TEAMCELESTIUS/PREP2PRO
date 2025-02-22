const { app, BrowserWindow, ipcMain, dialog } = require('electron/main')
const path = require('node:path')
const fs = require('fs')

// Add state management
const STATE_FILE = path.join(app.getPath('userData'), 'video-state.json')

// Function to save state
async function saveState(state) {
  try {
    await fs.promises.writeFile(STATE_FILE, JSON.stringify(state, null, 2))
  } catch (err) {
    console.error('Error saving state:', err)
  }
}

// Function to load state
async function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = await fs.promises.readFile(STATE_FILE, 'utf8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('Error loading state:', err)
  }
  return null
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 600,
    frame: true,
    fullscreen: false,
    maximizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Video Editor'
  })

  // Handle file open dialog with expanded format support
  ipcMain.handle('dialog:openFile', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select Video File',
        defaultPath: app.getPath('videos'), // Default to videos folder
        properties: [
          'openFile',
          'dontAddToRecent'  // Don't add to recent documents
        ],
        filters: [
          { 
            name: 'Video Files',
            extensions: [
              // Common formats with AVI variants
              'mp4', 'mov', 'avi', 'wmv', 'mkv', 'flv',
              'webm', 'mpeg', 'mpg', '3gp', 'm4v',
              // AVI specific formats
              'avi', 'divx', 'xvid',
              // Upper case variants
              'MP4', 'MOV', 'AVI', 'WMV', 'MKV', 'FLV',
              'WEBM', 'MPEG', 'MPG', '3GP', 'M4V',
              'AVI', 'DIVX', 'XVID'
            ]
          },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (canceled) {
        return null
      }

      return filePaths[0]
    } catch (err) {
      console.error('Error in file dialog:', err)
      return null
    }
  })

  // Add IPC handlers for state management
  ipcMain.handle('state:save', async (_, state) => {
    await saveState(state)
  })

  ipcMain.handle('state:load', async () => {
    return await loadState()
  })

  // Load the app and maximize the window
  win.loadFile('index.html')
  win.maximize()

  // Set custom title bar color (optional)
  win.setBackgroundColor('#2e2c29')
}

// Create window when app is ready
app.whenReady().then(() => {
  ipcMain.handle('ping', () => 'pong')
  createWindow()

  // On macOS, recreate window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})