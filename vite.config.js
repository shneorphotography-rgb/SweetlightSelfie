import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createWriteStream, mkdirSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join, extname } from 'path'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import Busboy from 'busboy'
import { analyzeCoupleCovers } from './scripts/couple-cover.mjs'
import { detectCoverFocuses, toCoverFocus } from './scripts/cover-focus.mjs'

function normalizeBasePath(value) {
  const input = String(value || '/').trim()
  if (!input || input === '/') return '/'
  return `/${input.replace(/^\/+|\/+$/g, '')}/`
}

function isPrivateIpv4(address) {
  if (address.startsWith('10.') || address.startsWith('192.168.')) return true
  const match = address.match(/^172\.(\d+)\./)
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31)
}

function getLocalNetworkAddress() {
  const ignoredInterface = /loopback|vethernet|docker|wsl|hyper-v|vmware|virtualbox|bluetooth/i
  const preferredInterface = /wi-?fi|wireless|wlan/i
  const candidates = []

  Object.entries(networkInterfaces()).forEach(([name, addresses]) => {
    if (ignoredInterface.test(name)) return

    addresses?.forEach(address => {
      if (address.family !== 'IPv4' || address.internal || !isPrivateIpv4(address.address)) return
      candidates.push({
        address: address.address,
        score: preferredInterface.test(name) ? 0 : 1,
      })
    })
  })

  return candidates.sort((a, b) => a.score - b.score)[0]?.address || null
}

function uploadPlugin() {
  return {
    name: 'cms-upload',
    configureServer(server) {
      server.middlewares.use('/api/share-info', (req, res, next) => {
        if (req.method !== 'GET') return next()

        const networkAddress = getLocalNetworkAddress()
        const port = String(req.headers.host || '').match(/:(\d+)$/)?.[1] || '3000'

        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({
          origin: networkAddress ? `http://${networkAddress}:${port}` : null,
        }))
      })

      server.middlewares.use('/api/client-shares', (req, res, next) => {
        const shareDirectory = join(process.cwd(), '.tmp-client-shares')
        const requestPath = String(req.url || '/').split('?')[0]

        if (req.method === 'POST' && (requestPath === '/' || requestPath === '')) {
          let body = ''
          let isTooLarge = false

          req.on('data', chunk => {
            if (isTooLarge) return
            body += chunk
            if (Buffer.byteLength(body) > 2 * 1024 * 1024) {
              isTooLarge = true
              res.statusCode = 413
              res.end(JSON.stringify({ error: 'Share payload is too large' }))
            }
          })

          req.on('end', async () => {
            if (isTooLarge) return

            try {
              const payload = JSON.parse(body)
              if (!payload.config || typeof payload.config !== 'object' || Array.isArray(payload.config)) {
                res.statusCode = 400
                res.end(JSON.stringify({ error: 'Invalid share configuration' }))
                return
              }

              mkdirSync(shareDirectory, { recursive: true })
              const token = randomBytes(12).toString('hex')
              await writeFile(
                join(shareDirectory, `${token}.json`),
                JSON.stringify({ createdAt: new Date().toISOString(), config: payload.config }),
                'utf8',
              )

              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.setHeader('Cache-Control', 'no-store')
              res.end(JSON.stringify({ token }))
            } catch {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Unable to create share link' }))
            }
          })
          return
        }

        const token = requestPath.replace(/^\/+/, '')
        if (req.method === 'GET' && /^[a-f0-9]{24}$/.test(token)) {
          readFile(join(shareDirectory, `${token}.json`), 'utf8')
            .then(raw => {
              const snapshot = JSON.parse(raw)
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.setHeader('Cache-Control', 'no-store')
              res.end(JSON.stringify({ config: snapshot.config }))
            })
            .catch(() => {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Share link not found' }))
            })
          return
        }

        next()
      })

      server.middlewares.use('/api/auto-cover', (req, res, next) => {
        if (req.method !== 'POST') return next()

        let body = ''
        let isTooLarge = false

        req.on('data', chunk => {
          if (isTooLarge) return
          body += chunk
          if (Buffer.byteLength(body) > 1024 * 1024) {
            isTooLarge = true
            res.statusCode = 413
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: 'Gallery payload is too large' }))
          }
        })

        req.on('end', async () => {
          if (isTooLarge) return

          try {
            const payload = JSON.parse(body)
            const images = Array.isArray(payload.images)
              ? payload.images.filter(source => typeof source === 'string').slice(0, 1000)
              : []

            if (!images.length) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json; charset=utf-8')
              res.end(JSON.stringify({ error: 'Gallery images are required' }))
              return
            }

            const [analysis] = await analyzeCoupleCovers([{
              id: payload.id,
              galleryKey: payload.galleryKey || payload.id,
              images,
              imageMetadata: (
                payload.imageMetadata
                && typeof payload.imageMetadata === 'object'
                && !Array.isArray(payload.imageMetadata)
              ) ? payload.imageMetadata : {},
            }], {
              projectRoot: process.cwd(),
            })

            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(JSON.stringify({ analysis }))
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({ error: error.message }))
          }
        })
      })

      server.middlewares.use('/api/upload', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        const uploadDir = join(process.cwd(), 'public', 'uploads')
        mkdirSync(uploadDir, { recursive: true })

        const bb = Busboy({ headers: req.headers })
        const savedPaths = []
        const savedFiles = []
        const writes = []

        bb.on('file', (_field, stream, info) => {
          const ext = extname(info.filename) || '.bin'
          const name = `${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
          const savePath = join(uploadDir, name)
          const publicPath = `/uploads/${name}`
          savedPaths.push(publicPath)
          savedFiles.push({ savePath, publicPath })

          const writer = createWriteStream(savePath)
          stream.pipe(writer)
          writes.push(new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
          }))
        })

        bb.on('finish', async () => {
          try {
            await Promise.all(writes)
            const detections = await detectCoverFocuses(
              savedFiles.map(file => file.savePath),
            )
            const media = savedFiles.map((file, index) => ({
              path: file.publicPath,
              coverFocus: toCoverFocus(detections[index], file.publicPath),
              width: detections[index]?.width || 0,
              height: detections[index]?.height || 0,
            }))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ paths: savedPaths, media }))
          } catch (err) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: err.message }))
          }
        })

        bb.on('error', (err) => {
          res.statusCode = 400
          res.end(JSON.stringify({ error: err.message }))
        })

        req.pipe(bb)
      })
    }
  }
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  plugins: [react(), uploadPlugin()],
  server: {
    port: 3000,
    open: true,
    host: true,
  }
})
