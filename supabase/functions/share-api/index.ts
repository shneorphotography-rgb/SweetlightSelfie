import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const ALLOWED_ORIGIN = Deno.env.get('SHARE_ALLOWED_ORIGIN') || '*'
const SHARE_SITE_URL = Deno.env.get('SHARE_SITE_URL') || ''
const TOKEN_ENCRYPTION_KEY = Deno.env.get('SHARE_TOKEN_ENCRYPTION_KEY') || ''
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const PUBLIC_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,128}$/

const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Vary': 'Origin',
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function apiError(message: string, status = 400, code = 'bad_request') {
  return jsonResponse({ error: message, code }, status)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function cleanText(value: unknown, maxLength = 500) {
  return value === null || value === undefined ? '' : String(value).trim().slice(0, maxLength)
}

function cleanNullableText(value: unknown, maxLength = 500) {
  return cleanText(value, maxLength) || null
}

function cleanDateTime(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date')
  return parsed.toISOString()
}

async function readBody(req: Request) {
  const contentLength = Number(req.headers.get('content-length') || 0)
  if (contentLength > 2 * 1024 * 1024) throw new Error('Payload is too large')
  const text = await req.text()
  if (new TextEncoder().encode(text).byteLength > 2 * 1024 * 1024) {
    throw new Error('Payload is too large')
  }
  return text.trim() ? JSON.parse(text) : {}
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function encodeBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('')
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0))
}

let encryptionKeyPromise: Promise<CryptoKey> | null = null

function encryptionKey() {
  if (!TOKEN_ENCRYPTION_KEY) throw new Error('Share token encryption key is unavailable')
  if (!encryptionKeyPromise) {
    const bytes = decodeBase64Url(TOKEN_ENCRYPTION_KEY)
    if (bytes.length !== 32) throw new Error('Share token encryption key must contain 32 bytes')
    encryptionKeyPromise = crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  return encryptionKeyPromise
}

async function encryptToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(),
    new TextEncoder().encode(token),
  )
  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`
}

async function decryptToken(value: unknown) {
  try {
    const [version, iv, ciphertext] = String(value || '').split('.')
    if (version !== 'v1' || !iv || !ciphertext) return null
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: decodeBase64Url(iv) },
      await encryptionKey(),
      decodeBase64Url(ciphertext),
    )
    return new TextDecoder().decode(plaintext)
  } catch {
    return null
  }
}

function buildPublicUrl(req: Request, token: string) {
  const fallback = req.headers.get('origin') || new URL(req.url).origin
  const url = new URL(SHARE_SITE_URL || fallback)
  url.searchParams.set('view', 'client')
  url.searchParams.set('share', token)
  url.hash = ''
  return url.toString()
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

function parseRoute(url: URL) {
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const functionIndex = segments.lastIndexOf('share-api')
  const route = functionIndex >= 0 ? segments.slice(functionIndex + 1) : segments
  return route[0] === 'api' ? route.slice(1) : route
}

function mapShare(row: Record<string, unknown>) {
  const isExpired = row.status === 'active'
    && Boolean(row.expires_at)
    && Date.parse(String(row.expires_at)) <= Date.now()
  return {
    id: row.id,
    kind: row.kind === 'general' ? 'general' : 'personal',
    label: row.label || row.client_name || '',
    client: {
      name: row.client_name || '',
      phone: row.client_phone || null,
      email: row.client_email || null,
    },
    event: {
      type: row.event_type || null,
      date: row.event_date || null,
      venue: row.event_venue || null,
    },
    clientName: row.client_name || '',
    clientPhone: row.client_phone || '',
    clientEmail: row.client_email || '',
    eventType: row.event_type || '',
    eventDate: row.event_date || '',
    venue: row.event_venue || '',
    internalNote: row.internal_note || '',
    internalNotes: row.internal_note || '',
    message: row.message || '',
    status: isExpired ? 'expired' : row.status,
    expiresAt: row.expires_at,
    currentVersion: row.current_version,
    tokenHint: row.token_hint,
    access: {
      count: row.access_count || 0,
      lastOpenedAt: row.last_opened_at,
    },
    archivedAt: row.archived_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSharedAt: null,
    storageMode: 'remote',
  }
}

function mapVersion(version: Record<string, unknown>) {
  const pricingSnapshot = isObject(version.pricing_snapshot) ? version.pricing_snapshot : {}
  return {
    id: version.id,
    number: version.version_number,
    version: version.version_number,
    schemaVersion: 1,
    resolvedConfig: version.resolved_config,
    pricingSnapshot,
    pricingOverrides: pricingSnapshot.pricingOverrides || {},
    resolvedPricing: pricingSnapshot.resolvedPricing || { packages: [], addons: [] },
    pricingSummary: version.pricing_summary,
    messageSnapshot: version.message_snapshot,
    changeNote: version.change_note,
    createdAt: version.created_at,
  }
}

async function decorateShare(
  row: Record<string, unknown>,
  req: Request,
  currentSnapshot: Record<string, unknown> | null = null,
) {
  const token = await decryptToken(row.token_ciphertext)
  return {
    ...mapShare(row),
    currentSnapshot,
    publicUrl: token ? buildPublicUrl(req, token) : null,
  }
}

function recordPatchValues(body: Record<string, unknown>) {
  const values: Record<string, unknown> = {}
  if ('client' in body || ['clientName', 'clientPhone', 'clientEmail'].some(key => key in body)) {
    const client = isObject(body.client) ? body.client : {
      name: body.clientName,
      phone: body.clientPhone,
      email: body.clientEmail,
    }
    values.client_name = cleanText(client.name, 160)
    values.client_phone = cleanNullableText(client.phone, 80)
    values.client_email = cleanNullableText(client.email, 254)
  }
  if ('event' in body || ['eventType', 'eventDate', 'venue'].some(key => key in body)) {
    const event = isObject(body.event) ? body.event : {
      type: body.eventType,
      date: body.eventDate,
      venue: body.venue,
    }
    values.event_type = cleanNullableText(event.type, 120)
    values.event_date = cleanNullableText(event.date, 32)
    values.event_venue = cleanNullableText(event.venue, 240)
  }
  if ('internalNote' in body) values.internal_note = cleanText(body.internalNote, 6000)
  if ('internalNotes' in body) values.internal_note = cleanText(body.internalNotes, 6000)
  if ('label' in body) values.label = cleanText(body.label, 240)
  if ('message' in body) values.message = cleanText(body.message, 6000)
  if ('expiresAt' in body) values.expires_at = cleanDateTime(body.expiresAt)
  if ('status' in body && ['active', 'draft'].includes(String(body.status))) {
    values.status = String(body.status)
  }
  return values
}

async function authenticatedClient(req: Request) {
  const authorization = req.headers.get('authorization') || ''
  if (!authorization.toLowerCase().startsWith('bearer ')) return null
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return {
    client,
    user: data.user,
    isOwner: data.user.app_metadata?.share_owner === true,
  }
}

async function getShareDetail(client: SupabaseClient, id: string, req: Request) {
  const { data: record, error } = await client
    .from('share_records')
    .select('id,token_ciphertext,kind,label,client_name,client_phone,client_email,event_type,event_date,event_venue,internal_note,message,status,expires_at,current_version,token_hint,access_count,last_opened_at,archived_at,revoked_at,created_at,updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!record) return null

  const { data: versions, error: versionsError } = await client
    .from('share_versions')
    .select('id,version_number,resolved_config,pricing_snapshot,pricing_summary,message_snapshot,change_note,created_at')
    .eq('share_id', id)
    .order('version_number', { ascending: false })
  if (versionsError) throw versionsError

  const mappedVersions = (versions || []).map(mapVersion)
  const currentSnapshot = mappedVersions.find(version => version.version === record.current_version) || null
  return {
    ...await decorateShare(record, req, currentSnapshot),
    versions: mappedVersions,
  }
}

function resolvedConfig(body: Record<string, unknown>) {
  const config = body.resolvedConfig ?? body.config
  if (!isObject(config)) throw new Error('Invalid share configuration')
  return config
}

async function createShare(client: SupabaseClient, body: Record<string, unknown>, req: Request) {
  const token = generateToken()
  const tokenHash = await hashToken(token)
  const tokenCiphertext = await encryptToken(token)
  const clientData = isObject(body.client) ? body.client : {
    name: body.clientName,
    phone: body.clientPhone,
    email: body.clientEmail,
  }
  const eventData = isObject(body.event) ? body.event : {
    type: body.eventType,
    date: body.eventDate,
    venue: body.venue,
  }
  const messageSnapshot = isObject(body.messageSnapshot)
    ? body.messageSnapshot
    : { includeText: true, text: cleanText(body.message, 6000) }
  const pricingSnapshot = body.pricingSnapshot ?? {
    pricingOverrides: body.pricingOverrides ?? {},
    resolvedPricing: body.resolvedPricing ?? { packages: [], addons: [] },
  }
  const status = ['active', 'draft'].includes(String(body.status)) ? String(body.status) : 'active'
  const { data: id, error } = await client.rpc('create_share_with_version', {
    p_token_hash: tokenHash,
    p_token_ciphertext: tokenCiphertext,
    p_token_hint: token.slice(-6),
    p_kind: body.kind === 'general' ? 'general' : 'personal',
    p_label: cleanText(body.label ?? clientData.name, 240),
    p_client: clientData,
    p_event: eventData,
    p_internal_note: cleanText(body.internalNote ?? body.internalNotes, 6000),
    p_message: cleanText(body.message ?? messageSnapshot.text, 6000),
    p_status: status,
    p_expires_at: cleanDateTime(body.expiresAt),
    p_resolved_config: resolvedConfig(body),
    p_pricing_snapshot: pricingSnapshot,
    p_pricing_summary: body.pricingSummary ?? {},
    p_message_snapshot: messageSnapshot,
    p_change_note: cleanNullableText(body.changeNote, 500),
  })
  if (error) throw error
  return { token, share: await getShareDetail(client, id, req) }
}

async function publicShare(token: string) {
  if (!PUBLIC_TOKEN_PATTERN.test(token)) return apiError('Share link not found', 404, 'share_not_found')
  if (!SUPABASE_SERVICE_ROLE_KEY) return apiError('Share service is unavailable', 503, 'service_unavailable')
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const tokenHash = await hashToken(token)
  const { data: record, error } = await service
    .from('share_records')
    .select('id,status,expires_at,current_version')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !record) return apiError('Share link not found', 404, 'share_not_found')
  if (record.status !== 'active') return apiError('Share link is unavailable', 410, 'share_unavailable')
  if (record.expires_at && Date.parse(record.expires_at) <= Date.now()) {
    return apiError('Share link has expired', 410, 'share_expired')
  }

  const { data: version, error: versionError } = await service
    .from('share_versions')
    .select('resolved_config')
    .eq('share_id', record.id)
    .eq('version_number', record.current_version)
    .maybeSingle()
  if (versionError || !version?.resolved_config) {
    return apiError('Share configuration is unavailable', 404, 'config_not_found')
  }

  await service.rpc('record_share_open', { p_share_id: record.id })
  // Do not add client, event, internal notes, pricing metadata, or database IDs here.
  return jsonResponse({ config: version.resolved_config })
}

async function listShares(client: SupabaseClient, url: URL, req: Request) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 40))
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)
  const sort = url.searchParams.get('sort') || 'eventDateAsc'
  const ascending = !(sort.endsWith('Desc') || sort.endsWith('-desc'))
  const sortColumn = (sort.startsWith('createdAt') || sort.startsWith('created-'))
    ? 'created_at'
    : sort.startsWith('name') ? 'client_name' : 'event_date'
  let query = client
    .from('share_records')
    .select('id,token_ciphertext,kind,label,client_name,client_phone,client_email,event_type,event_date,event_venue,status,expires_at,current_version,token_hint,access_count,last_opened_at,archived_at,revoked_at,created_at,updated_at', { count: 'exact' })

  const kind = url.searchParams.get('kind')
  if (kind === 'personal' || kind === 'general') query = query.eq('kind', kind)

  const requestedStatuses = (url.searchParams.get('status') || '')
    .split(',')
    .filter(value => ['draft', 'active', 'revoked', 'archived', 'expired'].includes(value))
  const storedStatuses = requestedStatuses.filter(value => value !== 'expired')
  const includesExpired = requestedStatuses.includes('expired')
  if (requestedStatuses.length) {
    const now = new Date().toISOString()
    const statusClauses: string[] = []
    const nonActiveStatuses = storedStatuses.filter(value => value !== 'active')
    if (nonActiveStatuses.length) statusClauses.push(`status.in.(${nonActiveStatuses.join(',')})`)
    if (storedStatuses.includes('active')) {
      statusClauses.push(`and(status.eq.active,or(expires_at.is.null,expires_at.gte.${now}))`)
    }
    if (includesExpired) statusClauses.push(`and(status.eq.active,expires_at.lt.${now})`)
    query = query.or(statusClauses.join(','))
  }
  const eventFrom = url.searchParams.get('eventFrom') || url.searchParams.get('dateFrom')
  const eventTo = url.searchParams.get('eventTo') || url.searchParams.get('dateTo')
  const createdFrom = url.searchParams.get('createdFrom')
  const createdTo = url.searchParams.get('createdTo')
  if (eventFrom) query = query.gte('event_date', eventFrom)
  if (eventTo) query = query.lte('event_date', eventTo)
  if (createdFrom) query = query.gte('created_at', createdFrom)
  if (createdTo) query = query.lte('created_at', createdTo)

  const rawSearch = url.searchParams.get('search') || url.searchParams.get('q') || ''
  const search = rawSearch.replace(/[^\p{L}\p{N}\s@+._-]/gu, '').trim().slice(0, 120)
  if (search) {
    const pattern = `%${search}%`
    query = query.or(`client_name.ilike.${pattern},client_phone.ilike.${pattern},client_email.ilike.${pattern},event_type.ilike.${pattern},event_venue.ilike.${pattern}`)
  }

  const { data, error, count } = await query
    .order(sortColumn, { ascending, nullsFirst: false })
    .range(offset, offset + limit - 1)
  if (error) throw error
  const records = data || []
  const versionByShare = new Map<string, Record<string, unknown>>()
  if (records.length) {
    const { data: versions, error: versionsError } = await client
      .from('share_versions')
      .select('id,share_id,version_number,pricing_snapshot,pricing_summary,message_snapshot,change_note,created_at')
      .in('share_id', records.map(record => record.id))
    if (versionsError) throw versionsError
    for (const version of versions || []) {
      const record = records.find(item => item.id === version.share_id)
      if (record && record.current_version === version.version_number) {
        versionByShare.set(version.share_id, mapVersion(version))
      }
    }
  }
  let items = await Promise.all(records.map(record => (
    decorateShare(record, req, versionByShare.get(record.id) || null)
  )))
  if (requestedStatuses.length) {
    items = items.filter(item => requestedStatuses.includes(String(item.status)))
  }
  return {
    items,
    shares: items,
    total: count || 0,
    limit,
    offset,
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return apiError('Share service is not configured', 503, 'service_unavailable')

  const url = new URL(req.url)
  const segments = parseRoute(url)

  try {
    if (req.method === 'GET' && ['public', 'public-shares'].includes(segments[0]) && segments[1]) {
      return await publicShare(segments[1])
    }

    const session = await authenticatedClient(req)
    if (!session) return apiError('Authentication required', 401, 'unauthorized')
    if (!session.isOwner) return apiError('Share owner permission is required', 403, 'forbidden')
    const { client } = session

    if (segments[0] !== 'shares') return apiError('Endpoint not found', 404, 'not_found')

    if (segments.length === 1 && req.method === 'GET') {
      return jsonResponse(await listShares(client, url, req))
    }
    if (segments.length === 1 && req.method === 'POST') {
      const body = await readBody(req)
      if (!isObject(body)) return apiError('Invalid request body')
      return jsonResponse(await createShare(client, body, req), 201)
    }

    const id = segments[1]
    if (!UUID_PATTERN.test(id)) return apiError('Share not found', 404, 'share_not_found')

    if (segments.length === 2 && req.method === 'GET') {
      const share = await getShareDetail(client, id, req)
      return share ? jsonResponse({ share }) : apiError('Share not found', 404, 'share_not_found')
    }

    if (segments.length === 2 && req.method === 'PATCH') {
      const body = await readBody(req)
      if (!isObject(body)) return apiError('Invalid request body')
      const values = recordPatchValues(body)
      if (!Object.keys(values).length) {
        const share = await getShareDetail(client, id, req)
        return share ? jsonResponse({ share }) : apiError('Share not found', 404, 'share_not_found')
      }
      const { data, error } = await client
        .from('share_records')
        .update(values)
        .eq('id', id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return apiError('Share not found', 404, 'share_not_found')
      return jsonResponse({ share: await getShareDetail(client, id, req) })
    }

    if (segments.length === 2 && req.method === 'DELETE') {
      const { data, error } = await client
        .from('share_records')
        .update({ status: 'archived', archived_at: new Date().toISOString() })
        .eq('id', id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return apiError('Share not found', 404, 'share_not_found')
      return jsonResponse({ share: await getShareDetail(client, id, req) })
    }

    const action = segments[2]
    if (action === 'versions' && req.method === 'POST') {
      const body = await readBody(req)
      if (!isObject(body)) return apiError('Invalid request body')
      const versionPricingSnapshot = body.pricingSnapshot ?? {
        pricingOverrides: body.pricingOverrides ?? {},
        resolvedPricing: body.resolvedPricing ?? { packages: [], addons: [] },
      }
      const { data: version, error } = await client.rpc('create_share_version', {
        p_share_id: id,
        p_resolved_config: resolvedConfig(body),
        p_pricing_snapshot: versionPricingSnapshot,
        p_pricing_summary: body.pricingSummary ?? {},
        p_message: 'message' in body ? cleanText(body.message, 6000) : null,
        p_message_snapshot: isObject(body.messageSnapshot) ? body.messageSnapshot : null,
        p_change_note: cleanNullableText(body.changeNote, 500),
      })
      if (error) throw error
      return jsonResponse({ share: await getShareDetail(client, id, req), version }, 201)
    }

    if (action === 'duplicate' && req.method === 'POST') {
      const body = await readBody(req)
      if (!isObject(body)) return apiError('Invalid request body')
      const source = await getShareDetail(client, id, req)
      if (!source) return apiError('Share not found', 404, 'share_not_found')
      const sourceVersion = source.versions.find((version: Record<string, unknown>) => version.number === source.currentVersion)
      return jsonResponse(await createShare(client, {
        label: body.label ?? `${source.label || source.clientName} — עותק`,
        client: body.client ?? source.client,
        event: body.event ?? source.event,
        internalNote: body.internalNote ?? source.internalNote,
        message: body.message ?? source.message,
        expiresAt: body.expiresAt ?? source.expiresAt,
        resolvedConfig: body.resolvedConfig ?? body.config ?? sourceVersion?.resolvedConfig,
        pricingSnapshot: body.pricingSnapshot ?? sourceVersion?.pricingSnapshot,
        pricingSummary: body.pricingSummary ?? sourceVersion?.pricingSummary,
        messageSnapshot: body.messageSnapshot ?? sourceVersion?.messageSnapshot,
        changeNote: body.changeNote ?? `Duplicated from ${id}`,
      }, req), 201)
    }

    const lifecycle = {
      revoke: { status: 'revoked', revoked_at: new Date().toISOString() },
      archive: { status: 'archived', archived_at: new Date().toISOString() },
      restore: { status: 'active', archived_at: null, revoked_at: null },
    }[action]
    if (lifecycle && req.method === 'POST') {
      const { data, error } = await client
        .from('share_records')
        .update(lifecycle)
        .eq('id', id)
        .select('id')
        .maybeSingle()
      if (error) throw error
      if (!data) return apiError('Share not found', 404, 'share_not_found')
      return jsonResponse({ share: await getShareDetail(client, id, req) })
    }

    return apiError('Endpoint not found', 404, 'not_found')
  } catch (error) {
    console.error('share-api', error instanceof Error ? error.message : error)
    const message = error instanceof SyntaxError ? 'Invalid JSON payload' : 'Unable to process share request'
    return apiError(message, error instanceof SyntaxError ? 400 : 500, error instanceof SyntaxError ? 'invalid_json' : 'internal_error')
  }
})
