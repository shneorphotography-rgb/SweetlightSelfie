import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'crypto'
import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'

const STORE_SCHEMA_VERSION = 1
const MAX_BODY_BYTES = 2 * 1024 * 1024
const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,128}$/
const LEGACY_TOKEN_PATTERN = /^[a-f0-9]{24}$/
const SHARE_STATUSES = new Set(['draft', 'active', 'revoked', 'archived'])

export class ShareStoreError extends Error {
  constructor(message, status = 400, code = 'share_store_error') {
    super(message)
    this.name = 'ShareStoreError'
    this.status = status
    this.code = code
  }
}

function nowIso() {
  return new Date().toISOString()
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function jsonClone(value) {
  if (value === undefined) return null
  return JSON.parse(JSON.stringify(value))
}

function cleanText(value, maxLength = 500) {
  if (value === null || value === undefined) return ''
  return String(value).trim().slice(0, maxLength)
}

function cleanNullableText(value, maxLength = 500) {
  const cleaned = cleanText(value, maxLength)
  return cleaned || null
}

function cleanIsoDateTime(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new ShareStoreError('Invalid date value', 400, 'invalid_date')
  }
  return parsed.toISOString()
}

function cleanEventDate(value) {
  const input = cleanText(value, 32)
  if (!input) return null
  const match = input.match(/^(\d{4}-\d{2}-\d{2})/)
  if (!match || Number.isNaN(new Date(`${match[1]}T00:00:00Z`).getTime())) {
    throw new ShareStoreError('Invalid event date', 400, 'invalid_event_date')
  }
  return match[1]
}

function normalizeClient(value = {}) {
  const input = isPlainObject(value) ? value : {}
  return {
    name: cleanText(input.name, 160),
    phone: cleanNullableText(input.phone, 80),
    email: cleanNullableText(input.email, 254),
  }
}

function normalizeEvent(value = {}) {
  const input = isPlainObject(value) ? value : {}
  return {
    type: cleanNullableText(input.type, 120),
    date: cleanEventDate(input.date),
    venue: cleanNullableText(input.venue, 240),
  }
}

function normalizePricingSummary(value = {}) {
  const input = isPlainObject(value) ? value : {}
  const totalMinor = Number.isFinite(Number(input.totalMinor))
    ? Math.round(Number(input.totalMinor))
    : null

  return {
    currency: cleanText(input.currency || 'ILS', 8).toUpperCase(),
    totalMinor,
    packageCount: Math.max(0, Math.round(Number(input.packageCount) || 0)),
    serviceCount: Math.max(0, Math.round(Number(input.serviceCount) || 0)),
    label: cleanNullableText(input.label, 160),
  }
}

function normalizeMessageSnapshot(value, fallbackMessage = '') {
  if (isPlainObject(value)) {
    return {
      includeText: value.includeText !== false,
      text: cleanText(value.text, 6000),
    }
  }
  return {
    includeText: true,
    text: cleanText(value ?? fallbackMessage, 6000),
  }
}

function normalizeStatus(value, fallback = 'active') {
  const status = cleanText(value || fallback, 24).toLowerCase()
  if (!SHARE_STATUSES.has(status)) {
    throw new ShareStoreError('Invalid share status', 400, 'invalid_status')
  }
  return status
}

function requireConfig(payload) {
  const config = payload?.resolvedConfig ?? payload?.config
  if (!isPlainObject(config)) {
    throw new ShareStoreError('Invalid share configuration', 400, 'invalid_config')
  }
  return jsonClone(config)
}

function normalizeVersionPayload(payload, versionNumber) {
  const pricingSnapshot = jsonClone(payload?.pricingSnapshot ?? {
    pricingOverrides: payload?.pricingOverrides ?? {},
    resolvedPricing: payload?.resolvedPricing ?? { packages: [], addons: [] },
  })
  return {
    id: `ver_${randomUUID()}`,
    number: versionNumber,
    version: versionNumber,
    schemaVersion: 1,
    createdAt: nowIso(),
    resolvedConfig: requireConfig(payload),
    pricingSnapshot,
    pricingOverrides: jsonClone(payload?.pricingOverrides ?? pricingSnapshot?.pricingOverrides ?? {}),
    resolvedPricing: jsonClone(payload?.resolvedPricing ?? pricingSnapshot?.resolvedPricing ?? { packages: [], addons: [] }),
    pricingSummary: normalizePricingSummary(payload?.pricingSummary),
    messageSnapshot: normalizeMessageSnapshot(payload?.messageSnapshot, payload?.message),
    changeNote: cleanNullableText(payload?.changeNote, 500),
  }
}

function createPublicToken() {
  // 24 random bytes = 192 bits of entropy. Only its SHA-256 digest is persisted.
  return randomBytes(24).toString('base64url')
}

export function hashShareToken(token) {
  return createHash('sha256').update(String(token), 'utf8').digest('hex')
}

function createShareId() {
  return `shr_${randomUUID()}`
}

function tokenHint(token) {
  return String(token).slice(-6)
}

function currentVersion(record) {
  return record.versions.find(version => version.number === record.currentVersion)
    || record.versions.at(-1)
    || null
}

function effectiveStatus(record) {
  if (record.status === 'active' && record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
    return 'expired'
  }
  return record.status
}

function serializeListItem(record) {
  const version = currentVersion(record)
  const currentSnapshot = version ? jsonClone(version) : null
  if (currentSnapshot) delete currentSnapshot.resolvedConfig
  return {
    id: record.id,
    kind: record.kind === 'general' ? 'general' : 'personal',
    label: record.label,
    client: jsonClone(record.client),
    clientName: record.client.name,
    clientPhone: record.client.phone || '',
    clientEmail: record.client.email || '',
    event: jsonClone(record.event),
    eventType: record.event.type || '',
    eventDate: record.event.date || '',
    venue: record.event.venue || '',
    status: effectiveStatus(record),
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archivedAt: record.archivedAt,
    revokedAt: record.revokedAt,
    currentVersion: record.currentVersion,
    currentSnapshot,
    pricingSummary: jsonClone(version?.pricingSummary || normalizePricingSummary()),
    tokenHint: record.tokenHint,
    access: jsonClone(record.access),
    lastSharedAt: record.lastSharedAt,
    storageMode: 'local-server',
  }
}

function serializeDetail(record) {
  return {
    ...serializeListItem(record),
    internalNote: record.internalNote,
    internalNotes: record.internalNote,
    message: record.message,
    versions: record.versions.map(version => jsonClone(version)),
  }
}

function emptyDatabase() {
  const createdAt = nowIso()
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    createdAt,
    updatedAt: createdAt,
    shares: [],
  }
}

function compareNullable(a, b) {
  if (a === b) return 0
  if (a === null || a === undefined || a === '') return 1
  if (b === null || b === undefined || b === '') return -1
  return String(a).localeCompare(String(b), 'he', { sensitivity: 'base', numeric: true })
}

function sortRecords(records, sort) {
  const sorted = [...records]
  const sorter = {
    eventDateAsc: (a, b) => compareNullable(a.event.date, b.event.date),
    'event-asc': (a, b) => compareNullable(a.event.date, b.event.date),
    eventDateDesc: (a, b) => compareNullable(b.event.date, a.event.date),
    'event-desc': (a, b) => compareNullable(b.event.date, a.event.date),
    createdAtAsc: (a, b) => compareNullable(a.createdAt, b.createdAt),
    createdAtDesc: (a, b) => compareNullable(b.createdAt, a.createdAt),
    'created-desc': (a, b) => compareNullable(b.createdAt, a.createdAt),
    nameAsc: (a, b) => compareNullable(a.client.name, b.client.name),
    'name-asc': (a, b) => compareNullable(a.client.name, b.client.name),
    nameDesc: (a, b) => compareNullable(b.client.name, a.client.name),
  }[sort] || ((a, b) => compareNullable(a.event.date, b.event.date))

  return sorted.sort((a, b) => sorter(a, b) || compareNullable(b.createdAt, a.createdAt))
}

function withinDate(value, from, to) {
  if (!value) return !from && !to
  if (from && value < from) return false
  if (to && value > to) return false
  return true
}

function matchesSearch(record, query) {
  if (!query) return true
  const haystack = [
    record.id,
    record.client.name,
    record.client.phone,
    record.client.email,
    record.event.type,
    record.event.date,
    record.event.venue,
    record.internalNote,
    record.tokenHint,
  ].filter(Boolean).join(' ').toLocaleLowerCase('he')

  return haystack.includes(query.toLocaleLowerCase('he'))
}

export class ShareStore {
  constructor({ directory }) {
    this.directory = directory
    this.filePath = join(directory, 'share-store.json')
    this.keyPath = join(directory, '.token-key')
    this.writeQueue = Promise.resolve()
    this.encryptionKeyPromise = null
  }

  async encryptionKey() {
    if (this.encryptionKeyPromise) return this.encryptionKeyPromise
    this.encryptionKeyPromise = (async () => {
      await mkdir(this.directory, { recursive: true })
      try {
        const key = Buffer.from((await readFile(this.keyPath, 'utf8')).trim(), 'base64url')
        if (key.length !== 32) throw new Error('Invalid token key')
        return key
      } catch (error) {
        if (error?.code !== 'ENOENT') {
          throw new ShareStoreError('Unable to read share token key', 500, 'token_key_failed')
        }
      }

      const generated = randomBytes(32)
      try {
        await writeFile(this.keyPath, `${generated.toString('base64url')}\n`, {
          encoding: 'utf8',
          mode: 0o600,
          flag: 'wx',
        })
        return generated
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error
        const existing = Buffer.from((await readFile(this.keyPath, 'utf8')).trim(), 'base64url')
        if (existing.length !== 32) throw new Error('Invalid token key')
        return existing
      }
    })()
    return this.encryptionKeyPromise
  }

  async encryptToken(token) {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', await this.encryptionKey(), iv)
    const ciphertext = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()])
    return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
  }

  async decryptToken(encrypted) {
    if (!encrypted) return null
    try {
      const [version, ivValue, tagValue, ciphertextValue] = String(encrypted).split('.')
      if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) return null
      const decipher = createDecipheriv(
        'aes-256-gcm',
        await this.encryptionKey(),
        Buffer.from(ivValue, 'base64url'),
      )
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8')
    } catch {
      return null
    }
  }

  async serializeRecord(record, detail = false) {
    const serialized = detail ? serializeDetail(record) : serializeListItem(record)
    return {
      ...serialized,
      token: await this.decryptToken(record.tokenCiphertext),
    }
  }

  async readDatabase() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'))
      if (!Array.isArray(parsed.shares)) throw new Error('Invalid share store')
      return parsed
    } catch (error) {
      if (error?.code === 'ENOENT') return emptyDatabase()
      throw new ShareStoreError('Unable to read share store', 500, 'store_read_failed')
    }
  }

  async writeDatabase(database) {
    await mkdir(this.directory, { recursive: true })
    const temporaryPath = `${this.filePath}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
    await writeFile(temporaryPath, `${JSON.stringify(database, null, 2)}\n`, 'utf8')
    await rename(temporaryPath, this.filePath)
  }

  mutate(mutator) {
    const operation = this.writeQueue.then(async () => {
      const database = await this.readDatabase()
      const result = await mutator(database)
      database.updatedAt = nowIso()
      await this.writeDatabase(database)
      return result
    })

    this.writeQueue = operation.catch(() => undefined)
    return operation
  }

  async list(options = {}) {
    await this.writeQueue
    const database = await this.readDatabase()
    const statuses = cleanText(options.status, 120)
      .split(',')
      .map(value => value.trim())
      .filter(value => SHARE_STATUSES.has(value) || value === 'expired')
    const eventFrom = cleanEventDate(options.eventFrom || options.dateFrom)
    const eventTo = cleanEventDate(options.eventTo || options.dateTo)
    const createdFrom = options.createdFrom ? cleanIsoDateTime(options.createdFrom) : null
    const createdTo = options.createdTo ? cleanIsoDateTime(options.createdTo) : null
    const query = cleanText(options.search || options.q, 240)
    const kind = ['personal', 'general'].includes(options.kind) ? options.kind : null
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 40))
    const offset = Math.max(0, Number(options.offset) || 0)

    const filtered = database.shares.filter(record => (
      (!kind || (record.kind || 'personal') === kind)
      &&
      (!statuses.length || statuses.includes(effectiveStatus(record)))
      && matchesSearch(record, query)
      && withinDate(record.event.date, eventFrom, eventTo)
      && withinDate(record.createdAt, createdFrom, createdTo)
    ))
    const sorted = sortRecords(filtered, cleanText(options.sort, 40))

    return {
      items: await Promise.all(
        sorted.slice(offset, offset + limit).map(record => this.serializeRecord(record)),
      ),
      total: sorted.length,
      limit,
      offset,
    }
  }

  async get(id) {
    await this.writeQueue
    const database = await this.readDatabase()
    const record = database.shares.find(item => item.id === id)
    if (!record) throw new ShareStoreError('Share not found', 404, 'share_not_found')
    return this.serializeRecord(record, true)
  }

  async create(payload = {}) {
    const token = createPublicToken()
    const tokenCiphertext = await this.encryptToken(token)
    const createdAt = nowIso()
    const firstVersion = normalizeVersionPayload(payload, 1)
    const client = normalizeClient(payload.client ?? {
      name: payload.clientName,
      phone: payload.clientPhone,
      email: payload.clientEmail,
    })
    const event = normalizeEvent(payload.event ?? {
      type: payload.eventType,
      date: payload.eventDate,
      venue: payload.venue,
    })
    const messageSnapshot = firstVersion.messageSnapshot
    const record = {
      id: createShareId(),
      kind: payload.kind === 'general' ? 'general' : 'personal',
      tokenHash: hashShareToken(token),
      tokenCiphertext,
      tokenHint: tokenHint(token),
      label: cleanText(payload.label || client.name, 240),
      client,
      event,
      internalNote: cleanText(payload.internalNote ?? payload.internalNotes, 6000),
      message: cleanText(payload.message ?? messageSnapshot.text, 6000),
      status: normalizeStatus(payload.status, 'active'),
      expiresAt: cleanIsoDateTime(payload.expiresAt),
      createdAt,
      updatedAt: createdAt,
      archivedAt: null,
      revokedAt: null,
      currentVersion: 1,
      versions: [firstVersion],
      access: { count: 0, lastOpenedAt: null },
      lastSharedAt: null,
    }

    await this.mutate(database => {
      database.shares.push(record)
      return record.id
    })

    const share = await this.get(record.id)
    return { token, share }
  }

  async update(id, payload = {}) {
    await this.mutate(database => {
      const record = database.shares.find(item => item.id === id)
      if (!record) throw new ShareStoreError('Share not found', 404, 'share_not_found')

      if ('client' in payload || ['clientName', 'clientPhone', 'clientEmail'].some(key => key in payload)) {
        record.client = normalizeClient(payload.client ?? {
          name: payload.clientName ?? record.client.name,
          phone: payload.clientPhone ?? record.client.phone,
          email: payload.clientEmail ?? record.client.email,
        })
      }
      if ('event' in payload || ['eventType', 'eventDate', 'venue'].some(key => key in payload)) {
        record.event = normalizeEvent(payload.event ?? {
          type: payload.eventType ?? record.event.type,
          date: payload.eventDate ?? record.event.date,
          venue: payload.venue ?? record.event.venue,
        })
      }
      if ('label' in payload) record.label = cleanText(payload.label, 240)
      if ('internalNote' in payload || 'internalNotes' in payload) {
        record.internalNote = cleanText(payload.internalNote ?? payload.internalNotes, 6000)
      }
      if ('message' in payload) record.message = cleanText(payload.message, 6000)
      if ('expiresAt' in payload) record.expiresAt = cleanIsoDateTime(payload.expiresAt)
      if ('status' in payload && ['active', 'draft'].includes(payload.status)) {
        record.status = normalizeStatus(payload.status)
      }
      record.updatedAt = nowIso()
      return record.id
    })
    return this.get(id)
  }

  async createVersion(id, payload = {}) {
    const result = await this.mutate(database => {
      const record = database.shares.find(item => item.id === id)
      if (!record) throw new ShareStoreError('Share not found', 404, 'share_not_found')
      const versionPayload = { ...payload, message: payload.message ?? record.message }
      const version = normalizeVersionPayload(versionPayload, record.currentVersion + 1)
      record.versions.push(version)
      record.currentVersion = version.number
      record.message = cleanText(versionPayload.message, 6000)
      record.updatedAt = nowIso()
      return { id: record.id, version: jsonClone(version) }
    })
    return { share: await this.get(result.id), version: result.version }
  }

  async duplicate(id, payload = {}) {
    const source = await this.get(id)
    const sourceVersion = source.versions.find(version => version.number === source.currentVersion)
    return this.create({
      label: payload.label ?? `${source.label || source.clientName} — עותק`,
      client: payload.client ?? source.client,
      event: payload.event ?? source.event,
      internalNote: payload.internalNote ?? source.internalNote,
      message: payload.message ?? source.message,
      expiresAt: payload.expiresAt ?? source.expiresAt,
      status: payload.status ?? 'active',
      resolvedConfig: payload.resolvedConfig ?? payload.config ?? sourceVersion.resolvedConfig,
      pricingSnapshot: payload.pricingSnapshot ?? sourceVersion.pricingSnapshot,
      pricingSummary: payload.pricingSummary ?? sourceVersion.pricingSummary,
      messageSnapshot: payload.messageSnapshot ?? sourceVersion.messageSnapshot,
      changeNote: payload.changeNote ?? `Duplicated from ${source.id}`,
    })
  }

  async setLifecycle(id, action) {
    const transitions = {
      revoke: { status: 'revoked', field: 'revokedAt' },
      archive: { status: 'archived', field: 'archivedAt' },
      restore: { status: 'active', field: null },
    }
    const transition = transitions[action]
    if (!transition) throw new ShareStoreError('Invalid lifecycle action', 400, 'invalid_action')

    await this.mutate(database => {
      const record = database.shares.find(item => item.id === id)
      if (!record) throw new ShareStoreError('Share not found', 404, 'share_not_found')
      record.status = transition.status
      record.updatedAt = nowIso()
      if (transition.field) record[transition.field] = record.updatedAt
      if (action === 'restore') {
        record.archivedAt = null
        record.revokedAt = null
      }
      return record.id
    })
    return this.get(id)
  }

  async resolvePublic(token) {
    if (!PUBLIC_TOKEN_PATTERN.test(String(token))) {
      throw new ShareStoreError('Share link not found', 404, 'share_not_found')
    }

    return this.mutate(database => {
      const digest = hashShareToken(token)
      const record = database.shares.find(item => item.tokenHash === digest)
      if (!record) throw new ShareStoreError('Share link not found', 404, 'share_not_found')
      if (record.status !== 'active') {
        throw new ShareStoreError('Share link is unavailable', 410, 'share_unavailable')
      }
      if (record.expiresAt && Date.parse(record.expiresAt) <= Date.now()) {
        throw new ShareStoreError('Share link has expired', 410, 'share_expired')
      }

      const version = currentVersion(record)
      if (!version?.resolvedConfig) {
        throw new ShareStoreError('Share configuration is unavailable', 404, 'config_not_found')
      }

      record.access.count += 1
      record.access.lastOpenedAt = nowIso()
      // Public reads deliberately expose only the resolved website configuration.
      return { config: jsonClone(version.resolvedConfig) }
    })
  }
}

async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = ''
    let size = 0
    let finished = false

    req.on('data', chunk => {
      if (finished) return
      size += chunk.length
      if (size > maxBytes) {
        finished = true
        reject(new ShareStoreError('Share payload is too large', 413, 'payload_too_large'))
        return
      }
      body += chunk
    })

    req.on('end', () => {
      if (finished) return
      if (!body.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new ShareStoreError('Invalid JSON payload', 400, 'invalid_json'))
      }
    })

    req.on('error', () => {
      if (!finished) reject(new ShareStoreError('Unable to read request', 400, 'request_failed'))
    })
  })
}

function sendJson(res, status, payload) {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

async function readLegacySnapshot(legacyDirectory, token) {
  if (!LEGACY_TOKEN_PATTERN.test(token)) return null
  try {
    const snapshot = JSON.parse(await readFile(join(legacyDirectory, `${token}.json`), 'utf8'))
    return isPlainObject(snapshot.config) ? { config: snapshot.config } : null
  } catch {
    return null
  }
}

export function createShareApiMiddleware({
  storeDirectory,
  legacyDirectory,
  store: providedStore,
  publicUrlBuilder,
}) {
  const store = providedStore || new ShareStore({ directory: storeDirectory })

  function decorateShare(share, req, explicitToken = null) {
    const token = explicitToken || share?.token
    if (!share || !token) return share
    const fallbackOrigin = `${req.socket?.encrypted ? 'https' : 'http'}://${req.headers.host || 'localhost:3000'}`
    const publicUrl = publicUrlBuilder
      ? publicUrlBuilder(req, token)
      : `${fallbackOrigin}/?view=client&share=${encodeURIComponent(token)}`
    return { ...share, token, publicUrl }
  }

  return async function shareApiMiddleware(req, res) {
    try {
      const requestUrl = new URL(req.url || '/', 'http://localhost')
      const segments = requestUrl.pathname.split('/').filter(Boolean).map(decodeURIComponent)

      if (segments.length === 0) {
        if (req.method === 'GET') {
          const result = await store.list(Object.fromEntries(requestUrl.searchParams))
          const items = result.items.map(item => decorateShare(item, req))
          sendJson(res, 200, { ...result, items, shares: items })
          return
        }
        if (req.method === 'POST') {
          const result = await store.create(await readJsonBody(req))
          sendJson(res, 201, {
            token: result.token,
            share: decorateShare(result.share, req, result.token),
          })
          return
        }
        sendJson(res, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
        return
      }

      const isRecordsRoute = segments[0] === 'records' && segments[1]
      const isDirectRecordRoute = segments[0]?.startsWith('shr_')
      if (isRecordsRoute || isDirectRecordRoute) {
        const id = isRecordsRoute ? segments[1] : segments[0]
        const action = isRecordsRoute ? segments[2] : segments[1]

        if (!action && req.method === 'GET') {
          sendJson(res, 200, { share: decorateShare(await store.get(id), req) })
          return
        }
        if (!action && req.method === 'PATCH') {
          sendJson(res, 200, { share: decorateShare(await store.update(id, await readJsonBody(req)), req) })
          return
        }
        if (!action && req.method === 'DELETE') {
          sendJson(res, 200, { share: decorateShare(await store.setLifecycle(id, 'archive'), req) })
          return
        }
        if (action === 'versions' && req.method === 'GET') {
          const share = await store.get(id)
          sendJson(res, 200, { versions: share.versions, currentVersion: share.currentVersion })
          return
        }
        if (action === 'versions' && req.method === 'POST') {
          const result = await store.createVersion(id, await readJsonBody(req))
          sendJson(res, 201, { ...result, share: decorateShare(result.share, req) })
          return
        }
        if (action === 'duplicate' && req.method === 'POST') {
          const result = await store.duplicate(id, await readJsonBody(req))
          sendJson(res, 201, {
            token: result.token,
            share: decorateShare(result.share, req, result.token),
          })
          return
        }
        if (['revoke', 'archive', 'restore'].includes(action) && req.method === 'POST') {
          sendJson(res, 200, { share: decorateShare(await store.setLifecycle(id, action), req) })
          return
        }

        sendJson(res, 405, { error: 'Method not allowed', code: 'method_not_allowed' })
        return
      }

      const publicToken = segments[0] === 'public' ? segments[1] : segments[0]
      if (req.method === 'GET' && publicToken && segments.length <= 2) {
        const legacy = await readLegacySnapshot(legacyDirectory, publicToken)
        if (legacy) {
          sendJson(res, 200, legacy)
          return
        }
        sendJson(res, 200, await store.resolvePublic(publicToken))
        return
      }

      sendJson(res, 404, { error: 'Endpoint not found', code: 'not_found' })
    } catch (error) {
      const status = error instanceof ShareStoreError ? error.status : 500
      const code = error instanceof ShareStoreError ? error.code : 'internal_error'
      sendJson(res, status, {
        error: status >= 500 ? 'Unable to process share request' : error.message,
        code,
      })
    }
  }
}
