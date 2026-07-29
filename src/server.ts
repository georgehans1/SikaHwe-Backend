import { createApp } from './app.js'
import { loadEnvironment } from './config/environment.js'

const environment = loadEnvironment()
const app = await createApp(environment)

const shutdown = async (): Promise<void> => {
  await app.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

try {
  await app.listen({
    host: environment.HOST,
    port: environment.PORT
  })
} catch (error) {
  app.log.error(error)
  process.exit(1)
}
