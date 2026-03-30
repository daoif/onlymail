import { ENV_LOCAL_PATH } from './lib/local-config'
import { writeWorkerDevVars } from './lib/dev-vars'

function main() {
  const outputPath = writeWorkerDevVars()
  console.log(`已从 ${ENV_LOCAL_PATH} 生成 ${outputPath}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
