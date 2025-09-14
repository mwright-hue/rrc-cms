import express from 'express'
import payload from 'payload'
import config from './payload.config'

const PORT = Number(process.env.PORT || 3000)

const start = async () => {
  const app = express()

  await payload.init({
    config,
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
