import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createWriteStream, mkdirSync } from 'fs'
import { join, extname } from 'path'
import { randomBytes } from 'crypto'
import { networkInterfaces } from 'os'
import Busboy from 'busboy'
import { analyzeCoupleCovers } from './scripts/couple-cover.mjs'
import { detectCoverFocuses, toCoverFocus } from './scripts/cover-focus.mjs'
import { createShareApiMiddleware, ShareStore } from './server/share-store.mjs'

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

function buildLocalClientShareUrl(req, token) {
  const host = String(req.headers.host || 'localhost:3000')
  const port = host.match(/:(\d+)$/)?.[1] || '3000'
  const networkAddress = getLocalNetworkAddress()
  const forwardedProtocol = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
  const protocol = forwardedProtocol || (req.socket?.encrypted ? 'https' : 'http')
  const origin = networkAddress
    ? `http://${networkAddress}:${port}`
    : `${protocol}://${host}`
  const clientUrl = new URL(normalizeBasePath(process.env.VITE_BASE_PATH), origin)
  clientUrl.searchParams.set('view', 'client')
  clientUrl.searchParams.set('share', token)
  return clientUrl.toString()
}

function isLoopbackRequest(req) {
  const address = String(req.socket?.remoteAddress || '').toLowerCase()
  return address === '::1'
    || address === '127.0.0.1'
    || address === '::ffff:127.0.0.1'
}

function denyRemoteManagement(res) {
  res.statusCode = 403
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ error: 'Share management is available only on this computer' }))
}

function denyPublicShareRoute(res) {
  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify({ error: 'Share link not found' }))
}

function isPublicShareToken(value) {
  return /^[A-Za-z0-9_-]{32}$/.test(String(value || ''))
    || /^[a-f0-9]{24}$/.test(String(value || ''))
}

function isLegacyPublicShareRead(req) {
  if (req.method !== 'GET') return false
  const pathname = new URL(req.url || '/', 'http://localhost').pathname
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 1) return isPublicShareToken(segments[0])
  return segments.length === 2
    && segments[0] === 'public'
    && isPublicShareToken(segments[1])
}

function uploadPlugin() {
  return {
    name: 'cms-upload',
    configureServer(server) {
      const shareStore = new ShareStore({
        directory: join(process.cwd(), '.tmp-share-center'),
      })
      const shareApi = createShareApiMiddleware({
        store: shareStore,
        storeDirectory: join(process.cwd(), '.tmp-share-center'),
        legacyDirectory: join(process.cwd(), '.tmp-client-shares'),
        publicUrlBuilder: buildLocalClientShareUrl,
      })
      const localManagementApi = (req, res, next) => (
        isLoopbackRequest(req) ? shareApi(req, res, next) : denyRemoteManagement(res)
      )
      const legacyShareApi = (req, res, next) => (
        isLegacyPublicShareRead(req)
          ? shareApi(req, res, next)
          : localManagementApi(req, res, next)
      )
      const publicShareApi = (req, res, next) => {
        const pathname = new URL(req.url || '/', 'http://localhost').pathname
        const segments = pathname.split('/').filter(Boolean)
        const isPublicTokenRead = req.method === 'GET'
          && segments.length === 1
          && /^[A-Za-z0-9_-]{32}$/.test(segments[0])
        return isPublicTokenRead ? shareApi(req, res, next) : denyPublicShareRoute(res)
      }

      server.middlewares.use('/api/share-info', (req, res, next) => {
        if (req.method !== 'GET') return next()

        const networkAddress = getLocalNetworkAddress()
        const port = String(req.headers.host || '').match(/:(\d+)$/)?.[1] || '3000'

        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({
          origin: networkAddress ? `http://${networkAddress}:${port}` : null,
        }))
      })

      server.middlewares.use('/api/client-shares', legacyShareApi)
      server.middlewares.use('/api/shares', localManagementApi)
      server.middlewares.use('/api/public-shares', publicShareApi)

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
