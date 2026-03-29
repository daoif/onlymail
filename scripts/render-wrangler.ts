import { resolveWranglerConfigFromEnv, writeWranglerToml } from './lib/wrangler-config'

function main() {
  const config = resolveWranglerConfigFromEnv(process.env)
  const outputPath = writeWranglerToml(config)
  console.log(`已生成 ${outputPath}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
