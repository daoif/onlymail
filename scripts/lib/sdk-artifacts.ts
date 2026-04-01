import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

export const ROOT_DIR = resolve(__dirname, '..', '..')
export const SDK_ARTIFACTS_DIR = resolve(ROOT_DIR, 'dist-sdk')
export const NODE_SDK_ARTIFACTS_DIR = resolve(SDK_ARTIFACTS_DIR, 'nodejs')
export const PYTHON_SDK_ARTIFACTS_DIR = resolve(SDK_ARTIFACTS_DIR, 'python')
export const NODE_SDK_DIR = resolve(ROOT_DIR, 'sdk/nodejs')
export const PYTHON_SDK_DIR = resolve(ROOT_DIR, 'sdk/python')

export function runCommand(command: string, args: string[], cwd = ROOT_DIR, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`命令失败：${command} ${args.join(' ')}`)
  }
}

export function findArtifact(directory: string, matcher: (name: string) => boolean, label: string) {
  const matches = readdirSync(directory).filter(matcher)
  if (matches.length !== 1) {
    throw new Error(`${label} 数量不正确：${matches.join(', ') || '空'}`)
  }

  return resolve(directory, matches[0]!)
}

export function createTempDir(prefix: string) {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function removeDir(path: string) {
  rmSync(path, { recursive: true, force: true })
}

export function getVenvPythonPath(venvDir: string) {
  return process.platform === 'win32'
    ? resolve(venvDir, 'Scripts/python.exe')
    : resolve(venvDir, 'bin/python')
}
