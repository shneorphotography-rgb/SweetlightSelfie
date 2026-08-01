import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ShareStore, ShareStoreError } from './share-store.mjs'

async function withStore(run) {
  const directory = await mkdtemp(join(tmpdir(), 'sweetlight-share-store-'))
  try {
    await run(new ShareStore({ directory }), directory)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function payload(overrides = {}) {
  return {
    kind: 'personal',
    label: 'נועה ויובל',
    client: { name: 'נועה ויובל', phone: '0500000000' },
    event: { type: 'חתונה', date: '2027-05-14', venue: 'חוות רונית' },
    message: 'נשמח לעמוד לשירותכם',
    resolvedConfig: {
      sections: {
        pricing: {
          packages: [{ id: 'full-day', title: 'יום מלא', price: '6,900', currency: '₪' }],
        },
      },
    },
    pricingSummary: { total: '6,900 ₪', changedCount: 1 },
    messageSnapshot: { includeText: true, text: 'נשמח לעמוד לשירותכם' },
    ...overrides,
  }
}

test('creates a private record and exposes only its resolved config publicly', async () => {
  await withStore(async (store, directory) => {
    const { share, token } = await store.create(payload())

    assert.equal(share.kind, 'personal')
    assert.equal(share.currentVersion, 1)
    assert.equal(share.clientName, 'נועה ויובל')
    const personalList = await store.list({ kind: 'personal' })
    assert.equal(personalList.total, 1)
    assert.equal('resolvedConfig' in personalList.items[0].currentSnapshot, false)
    assert.ok(personalList.items[0].currentSnapshot.resolvedPricing)
    assert.equal((await store.list({ kind: 'general' })).total, 0)

    const publicPayload = await store.resolvePublic(token)
    assert.deepEqual(Object.keys(publicPayload), ['config'])
    assert.equal(publicPayload.config.sections.pricing.packages[0].price, '6,900')
    assert.equal('client' in publicPayload, false)

    const persisted = await readFile(join(directory, 'share-store.json'), 'utf8')
    assert.equal(persisted.includes(token), false)
    assert.equal(persisted.includes('0500000000'), true)
  })
})

test('keeps the public URL stable while a new version replaces the visible snapshot', async () => {
  await withStore(async store => {
    const { share, token } = await store.create(payload({ kind: 'general' }))
    const updated = await store.createVersion(share.id, payload({
      resolvedConfig: { sections: { pricing: { packages: [{ id: 'full-day', price: '7,200' }] } } },
      changeNote: 'עדכון מחירון כללי',
    }))

    assert.equal(updated.share.currentVersion, 2)
    assert.equal(updated.share.token, token)
    assert.equal(updated.share.versions.length, 2)
    assert.equal((await store.resolvePublic(token)).config.sections.pricing.packages[0].price, '7,200')
  })
})

test('derives expiry and blocks expired, revoked, and archived public links', async () => {
  await withStore(async store => {
    const expired = await store.create(payload({ expiresAt: '2020-01-01T00:00:00.000Z' }))
    const expiredList = await store.list({ status: 'expired' })
    assert.equal(expiredList.total, 1)
    assert.equal(expiredList.items[0].status, 'expired')
    await assert.rejects(
      store.resolvePublic(expired.token),
      error => error instanceof ShareStoreError && error.status === 410 && error.code === 'share_expired',
    )

    const active = await store.create(payload({ label: 'קישור לביטול' }))
    await store.setLifecycle(active.share.id, 'revoke')
    await assert.rejects(
      store.resolvePublic(active.token),
      error => error instanceof ShareStoreError && error.status === 410,
    )

    await store.setLifecycle(active.share.id, 'restore')
    assert.ok((await store.resolvePublic(active.token)).config)
    await store.setLifecycle(active.share.id, 'archive')
    await assert.rejects(store.resolvePublic(active.token), { status: 410 })
  })
})

test('searches by event details without leaking general links into personal history', async () => {
  await withStore(async store => {
    await store.create(payload())
    await store.create(payload({
      kind: 'general',
      label: 'האתר הציבורי',
      client: { name: 'האתר הציבורי' },
      event: { type: 'כללי' },
    }))

    const personal = await store.list({ kind: 'personal', search: 'רונית' })
    assert.equal(personal.total, 1)
    assert.equal(personal.items[0].kind, 'personal')
    assert.equal((await store.list({ kind: 'personal', search: 'הציבורי' })).total, 0)
  })
})
