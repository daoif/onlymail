import { execSync } from 'node:child_process'
import { ROOT_DIR } from './local-config'

function readValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) {
      return value
    }
  }

  return ''
}

function normalizeGithubRepo(remoteUrl: string) {
  const normalized = remoteUrl.trim().replace(/\\/g, '/')
  const match = normalized.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/i)
  return match?.[1] || ''
}

export function normalizeGithubRepoForTest(remoteUrl: string) {
  return normalizeGithubRepo(remoteUrl)
}

function getGitRemoteUrl(remoteName: string) {
  try {
    return execSync(`git remote get-url ${remoteName}`, {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

export function inferGitHubRepository() {
  const workflowContext = readValue('GITHUB_REPOSITORY')
  if (workflowContext) {
    return workflowContext
  }

  const remoteUrl = getGitRemoteUrl('origin')
  if (!remoteUrl) {
    return ''
  }

  return normalizeGithubRepo(remoteUrl)
}
