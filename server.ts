import express from 'express'
import payload from 'payload'
import path from 'path'
import { fileURLToPath } from 'url'

const PORT = Number(process.env.PORT || 3000)

const start = async () => {
  const app = express()

  const dirname = path.dirname(fileURLToPath(import.meta.url))
  const configPath = path.resolve(dirname, 'payload.config.ts')

  await payload.init({
    configPath,
    // Config is auto-resolved from payload.config.ts at project root
    secret: process.env.PAYLOAD_SECRET as string,
    express: app,
    onInit: async () => {
      console.log('Payload initialized')
    },
  })

  app.listen(PORT, () => {
    console.log(`CMS server listening on :${PORT}`)
  })
}

start().catch((err) => {
  console.error('Server failed to start', err)
  process.exit(1)
})
