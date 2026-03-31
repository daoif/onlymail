import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT_DIR = resolve(__dirname, '..')
const ROOT_PACKAGE_PATH = resolve(ROOT_DIR, 'package.json')
const NODE_SDK_PACKAGE_PATH = resolve(ROOT_DIR, 'sdk/nodejs/package.json')
const PYTHON_SDK_PROJECT_PATH = resolve(ROOT_DIR, 'sdk/python/pyproject.toml')
const APP_RELEASE_PATH = resolve(ROOT_DIR, 'shared/app-release.ts')

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
}

function writeJson(path: string, value: Record<string, unknown>) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
}

function validateVersion(input: string) {
  if (!/^\d+\.\d+\.\d+$/.test(input)) {
    throw new Error(`版本号格式不正确：${input}。只接受 x.y.z，例如 0.1.0`)
  }
}

function replaceTomlVersion(content: string, version: string) {
  if (!/version = "[^"]+"/.test(content)) {
    throw new Error('未找到 pyproject.toml 的 version 字段')
  }

  return content.replace(/version = "[^"]+"/, `version = "${version}"`)
}

function replaceAppReleaseVersion(content: string, version: string) {
  if (!/export const APP_VERSION = '[^']+'/.test(content)) {
    throw new Error('未找到 shared/app-release.ts 的 APP_VERSION')
  }

  return content.replace(/export const APP_VERSION = '[^']+'/, `export const APP_VERSION = '${version}'`)
}

function main() {
  const version = process.argv[2]?.trim()
  if (!version) {
    throw new Error('用法：pnpm set:version 0.1.0')
  }

  validateVersion(version)

  const rootPackage = readJson(ROOT_PACKAGE_PATH)
  rootPackage.version = version
  writeJson(ROOT_PACKAGE_PATH, rootPackage)

  const nodeSdkPackage = readJson(NODE_SDK_PACKAGE_PATH)
  nodeSdkPackage.version = version
  writeJson(NODE_SDK_PACKAGE_PATH, nodeSdkPackage)

  const pythonProject = readFileSync(PYTHON_SDK_PROJECT_PATH, 'utf-8')
  writeFileSync(PYTHON_SDK_PROJECT_PATH, replaceTomlVersion(pythonProject, version), 'utf-8')

  const appRelease = readFileSync(APP_RELEASE_PATH, 'utf-8')
  writeFileSync(APP_RELEASE_PATH, replaceAppReleaseVersion(appRelease, version), 'utf-8')

  console.log(`已更新版本号为 ${version}`)
  console.log('已同步位置：')
  console.log('- package.json')
  console.log('- sdk/nodejs/package.json')
  console.log('- sdk/python/pyproject.toml')
  console.log('- shared/app-release.ts')
}

main()
