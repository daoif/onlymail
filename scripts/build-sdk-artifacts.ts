import { existsSync, mkdirSync, rmSync } from 'node:fs'

import {
  NODE_SDK_ARTIFACTS_DIR,
  NODE_SDK_DIR,
  PYTHON_SDK_ARTIFACTS_DIR,
  PYTHON_SDK_DIR,
  SDK_ARTIFACTS_DIR,
  runCommand,
} from './lib/sdk-artifacts'

function ensureCleanDir(path: string) {
  rmSync(path, { recursive: true, force: true })
  mkdirSync(path, { recursive: true })
}

function cleanupPythonBuildState() {
  const transientDirs = ['build', 'onlymail_sdk.egg-info']
  for (const name of transientDirs) {
    const path = `${PYTHON_SDK_DIR}/${name}`
    if (existsSync(path)) {
      rmSync(path, { recursive: true, force: true })
    }
  }
}

function buildNodeSdkArtifacts() {
  runCommand('pnpm', ['--dir', 'sdk/nodejs', 'run', 'build'])
  runCommand('npm', ['pack', '--ignore-scripts', '--pack-destination', NODE_SDK_ARTIFACTS_DIR], NODE_SDK_DIR)
}

function buildPythonSdkArtifacts() {
  cleanupPythonBuildState()
  runCommand('python', ['-m', 'build', '--sdist', '--wheel', '--outdir', PYTHON_SDK_ARTIFACTS_DIR], PYTHON_SDK_DIR)
  cleanupPythonBuildState()
}

function main() {
  ensureCleanDir(SDK_ARTIFACTS_DIR)
  ensureCleanDir(NODE_SDK_ARTIFACTS_DIR)
  ensureCleanDir(PYTHON_SDK_ARTIFACTS_DIR)

  buildNodeSdkArtifacts()
  buildPythonSdkArtifacts()

  console.log('SDK 发布产物已生成：')
  console.log(`- ${NODE_SDK_ARTIFACTS_DIR}`)
  console.log(`- ${PYTHON_SDK_ARTIFACTS_DIR}`)
}

main()
