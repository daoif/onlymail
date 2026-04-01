import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  NODE_SDK_ARTIFACTS_DIR,
  PYTHON_SDK_ARTIFACTS_DIR,
  createTempDir,
  findArtifact,
  getVenvPythonPath,
  removeDir,
  runCommand,
} from './lib/sdk-artifacts'

function verifyNodeSdk() {
  const packagePath = findArtifact(NODE_SDK_ARTIFACTS_DIR, (name) => name.endsWith('.tgz'), 'Node SDK tgz')
  const tempDir = createTempDir('onlymail-node-sdk-')

  try {
    mkdirSync(tempDir, { recursive: true })
    writeFileSync(
      `${tempDir}/package.json`,
      `${JSON.stringify({ name: 'onlymail-node-sdk-smoke', private: true, type: 'module' }, null, 2)}\n`,
      'utf-8',
    )
    writeFileSync(
      `${tempDir}/smoke.mjs`,
      "import { OnlyMailClient } from '@onlymail/sdk-nodejs'\nconst client = new OnlyMailClient('https://example.com', 'test-key')\nif (typeof client.createAddress !== 'function') {\n  throw new Error('createAddress 不可用')\n}\n",
      'utf-8',
    )
    runCommand('npm', ['install', packagePath], tempDir)
    runCommand('node', [resolve(tempDir, 'smoke.mjs')], tempDir)
  } finally {
    removeDir(tempDir)
  }
}

function verifyPythonSdk() {
  const wheelPath = findArtifact(PYTHON_SDK_ARTIFACTS_DIR, (name) => name.endsWith('.whl'), 'Python SDK wheel')
  const sdistPath = findArtifact(PYTHON_SDK_ARTIFACTS_DIR, (name) => name.endsWith('.tar.gz'), 'Python SDK sdist')
  const tempDir = createTempDir('onlymail-python-sdk-')
  const venvDir = `${tempDir}/venv`

  try {
    runCommand('python', ['-m', 'venv', venvDir])
    const pythonExec = getVenvPythonPath(venvDir)
    const smokePath = resolve(tempDir, 'smoke.py')
    writeFileSync(
      smokePath,
      "from onlymail_sdk import OnlyMailClient\nclient = OnlyMailClient('https://example.com', api_key='test-key')\nassert client.base_url == 'https://example.com'\nassert client.api_key == 'test-key'\n",
      'utf-8',
    )
    runCommand(pythonExec, ['-m', 'pip', 'install', wheelPath])
    runCommand(pythonExec, [smokePath])
    runCommand(pythonExec, ['-m', 'pip', 'install', '--force-reinstall', sdistPath])
    runCommand(pythonExec, [smokePath])
  } finally {
    removeDir(tempDir)
  }
}

function main() {
  verifyNodeSdk()
  verifyPythonSdk()
  console.log('SDK 发布产物安装验证通过')
}

main()
