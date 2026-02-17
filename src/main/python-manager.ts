import { app } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

type PythonStatus = 'idle' | 'starting' | 'ready' | 'error' | 'stopped'

export class PythonManager {
  private childProcess: ChildProcessWithoutNullStreams | null = null
  private port: number | null = null
  private status: PythonStatus = 'idle'
  private stopInProgress: Promise<void> | null = null

  private async waitForHealth(baseUrl: string, timeoutMs = 15000): Promise<void> {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const resp = await fetch(`${baseUrl}/health`)
        if (resp.ok) {
          this.status = 'ready'
          return
        }
      } catch {
        // Backend may still be booting.
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    this.status = 'error'
    throw new Error('Python backend health check timeout')
  }

  private resolveDevPythonCommand(entry: string, port: number): { command: string; args: string[] } {
    const explicitPython = process.env.BACKEND_PYTHON_PATH
    if (explicitPython) {
      return {
        command: explicitPython,
        args: [entry, '--port', String(port)]
      }
    }

    if (process.platform === 'win32') {
      const userProfile = process.env.USERPROFILE ?? ''
      const candidates = [
        'E:\\apps\\anaconda3\\envs\\dl\\python.exe',
        'C:\\ProgramData\\anaconda3\\envs\\dl\\python.exe',
        userProfile ? join(userProfile, 'anaconda3', 'envs', 'dl', 'python.exe') : ''
      ]
      for (const candidate of candidates) {
        if (candidate && existsSync(candidate)) {
          return {
            command: candidate,
            args: [entry, '--port', String(port)]
          }
        }
      }
    }

    const condaExe = process.env.CONDA_EXE ?? 'conda'
    return {
      command: condaExe,
      args: ['run', '-n', 'dl', 'python', entry, '--port', String(port)]
    }
  }

  public async start(port: number): Promise<void> {
    if (this.childProcess) {
      return
    }
    this.status = 'starting'
    this.port = port

    const isDev = !app.isPackaged
    const backendRoot = isDev
      ? join(app.getAppPath(), 'backend')
      : join(process.resourcesPath, 'backend')

    let command = 'python'
    let args: string[] = []

    if (isDev) {
      const entry = join(backendRoot, 'app', 'main.py')
      const resolved = this.resolveDevPythonCommand(entry, port)
      command = resolved.command
      args = resolved.args
    } else {
      const binary = process.platform === 'win32' ? 'backend.exe' : 'backend'
      command = join(backendRoot, binary)
      args = ['--port', String(port)]
    }

    const existingPythonPath = process.env.PYTHONPATH ?? ''
    const pathDelimiter = process.platform === 'win32' ? ';' : ':'
    const pythonPath = existingPythonPath
      ? `${backendRoot}${pathDelimiter}${existingPythonPath}`
      : backendRoot

    this.childProcess = spawn(command, args, {
      cwd: backendRoot,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONPATH: pythonPath
      }
    })

    this.childProcess.stdout.on('data', (data) => {
      console.log(`[python][stdout] ${String(data).trim()}`)
    })
    this.childProcess.stderr.on('data', (data) => {
      console.error(`[python][stderr] ${String(data).trim()}`)
    })
    this.childProcess.on('exit', (code) => {
      console.log(`[python] process exited with code=${code}`)
      this.childProcess = null
      this.status = 'stopped'
    })

    try {
      await this.waitForHealth(`http://127.0.0.1:${port}`)
    } catch (error) {
      await this.stop()
      throw error
    }
  }

  public async stop(): Promise<void> {
    if (this.stopInProgress) {
      await this.stopInProgress
      return
    }
    if (!this.childProcess) {
      this.status = 'stopped'
      return
    }

    const processRef = this.childProcess
    const pid = processRef.pid
    this.stopInProgress = new Promise((resolve) => {
      let settled = false
      const settle = (): void => {
        if (settled) {
          return
        }
        settled = true
        this.stopInProgress = null
        resolve()
      }

      processRef.once('exit', () => {
        this.childProcess = null
        this.status = 'stopped'
        settle()
      })

      processRef.kill('SIGTERM')

      setTimeout(() => {
        if (settled) {
          return
        }
        if (process.platform === 'win32' && pid) {
          spawn('taskkill', ['/pid', String(pid), '/T', '/F'])
        } else if (this.childProcess) {
          this.childProcess.kill('SIGKILL')
        }
      }, 5000)
    })
    await this.stopInProgress
  }

  public getPort(): number | null {
    return this.port
  }

  public getStatus(): PythonStatus {
    return this.status
  }

  public getBaseUrl(): string | null {
    if (!this.port) {
      return null
    }
    return `http://127.0.0.1:${this.port}`
  }

  public async pingRest(): Promise<boolean> {
    const baseUrl = this.getBaseUrl()
    if (!baseUrl) {
      return false
    }
    const resp = await fetch(`${baseUrl}/api/system/ping`)
    return resp.ok
  }
}
