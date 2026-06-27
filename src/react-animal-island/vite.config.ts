/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '动森训练岛',
        short_name: '训练岛',
        description: '两个人一起打卡建设的小基地',
        start_url: './index.html',
        display: 'standalone',
        background_color: '#7dc395',
        theme_color: '#59c9a5',
        icons: [{ src: './assets/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate'
              || request.destination === 'document'
              || request.destination === 'script'
              || request.destination === 'style'
              || url.pathname.endsWith('/plan.json')
              || url.pathname.endsWith('/manifest.webmanifest'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'fitness-island-shell',
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: ({ request, url }) => request.destination === 'image'
              || request.destination === 'font'
              || /\.(svg|png|webp|jpg|jpeg|gif|woff|woff2)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'fitness-island-assets',
            },
          },
        ],
      },
    }),
    legacyDevApi(),
  ],
  server: {
    host: true,
    allowedHosts: true,
  },
  test: {
    setupFiles: ['./src/test-setup.ts'],
    server: {
      deps: {
        inline: ['animal-island-ui'],
      },
    },
  },
})

function legacyDevApi() {
  const root = __dirname
  const dataDir = path.join(root, 'data')
  const fixedUsers = ['哥哥', '乖宝']

  const applyStateApi = (server: any) => {
      server.middlewares.use('/api/state.php', async (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url || '', 'http://dev.local')
        const room = (url.searchParams.get('room') || 'fitness-island-v1').replace(/[^a-zA-Z0-9_-]/g, '')
        const file = path.join(dataDir, `${room}.json`)
        fs.mkdirSync(dataDir, { recursive: true })
        const state = readState(file, room)

        if (req.method === 'GET') {
          sendJson(res, state)
          return
        }
        if (req.method !== 'POST') {
          res.statusCode = 405
          sendJson(res, { ok: false, error: 'Method not allowed' })
          return
        }

        try {
          const body = JSON.parse(await readBody(req))
          const user = body.user || {}
          const displayName = String(user.displayName || user.username || '').trim()
          if (!fixedUsers.includes(displayName)) {
            res.statusCode = 403
            sendJson(res, { ok: false, error: 'User is not allowed' })
            return
          }
          const userKey = `name_${sha256(displayName.toLowerCase()).slice(0, 24)}`
          const existing = state.users[userKey]
          const incomingVersion = Number(user.syncVersion || 0)
          const storedVersion = Number(existing?.syncVersion || 0)
          if (existing && incomingVersion < storedVersion) {
            res.statusCode = 409
            sendJson(res, { ok: false, error: 'Stale data rejected', version: storedVersion, users: state.users, shared: state.shared })
            return
          }
          state.users[userKey] = {
            ...user,
            userKey,
            username: displayName,
            displayName,
            syncVersion: storedVersion + 1,
            lastActive: Date.now(),
            updated: Date.now(),
          }
          mergeShared(state, body.shared, userKey, displayName)
          state.updatedAt = Date.now()
          fs.writeFileSync(file, JSON.stringify(state, null, 2))
          sendJson(res, state)
        } catch (error) {
          res.statusCode = 400
          sendJson(res, { ok: false, error: error instanceof Error ? error.message : 'Invalid payload' })
        }
      })
  }

  return {
    name: 'legacy-dev-api',
    configureServer: applyStateApi,
    configurePreviewServer: applyStateApi,
  }
}

function readState(file: string, room: string) {
  if (!fs.existsSync(file)) {
    return { ok: true, version: 1, room, updatedAt: 0, users: {}, shared: { giftClaims: {}, wishLists: {}, wishFulfillments: {}, mailbox: [], events: {}, decor: {}, placedCrafts: [], buildingPositions: {} } }
  }
  const state = JSON.parse(fs.readFileSync(file, 'utf8'))
  state.ok = true
  state.room = room
  state.users ||= {}
  state.shared ||= {}
  state.shared.giftClaims ||= {}
  state.shared.wishLists ||= {}
  state.shared.wishFulfillments ||= {}
  state.shared.mailbox ||= []
  state.shared.events ||= {}
  state.shared.decor ||= {}
  state.shared.placedCrafts ||= []
  state.shared.buildingPositions ||= {}
  return state
}

interface DevShared {
  mailbox: Record<string, unknown>[]
  giftClaims: Record<string, unknown>
  wishLists: Record<string, unknown>
  wishFulfillments: Record<string, unknown>
  decor: Record<string, unknown>
  events: Record<string, unknown>
  placedCrafts: Record<string, unknown>[]
  buildingPositions: Record<string, { x: number; y: number; ownerKey?: string; ownerName?: string; updatedAt?: number }>
}
interface DevState {
  users: Record<string, unknown>
  shared: DevShared
  updatedAt?: number
  [key: string]: unknown
}
interface DevPatch {
  mailboxEntry?: { id?: unknown; text?: unknown; createdAt?: unknown }
  giftClaim?: { id?: string } & Record<string, unknown>
  wishList?: unknown
  wishFulfillment?: { id?: unknown; item?: unknown; ownerKey?: unknown; ownerName?: unknown; fulfilledAt?: unknown }
  decorItem?: { id?: string } & Record<string, unknown>
  craftPlacement?: { id?: string; recipeId?: string; x?: number; y?: number; placedAt?: number }
  craftPosition?: { id?: string; x?: number; y?: number }
  buildingPosition?: { id?: string; x?: number; y?: number }
  weeklyEvent?: { id?: string } & Record<string, unknown>
}

function mergeShared(state: DevState, patch: DevPatch | null, userKey: string, displayName: string) {
  if (!patch) return
  const now = Date.now()
  if (patch.mailboxEntry?.text) {
    state.shared.mailbox.push({
      id: String(patch.mailboxEntry.id || `mail_${Date.now()}`),
      authorKey: userKey,
      authorName: displayName,
      text: String(patch.mailboxEntry.text).trim().slice(0, 80),
      createdAt: Number(patch.mailboxEntry.createdAt || now),
    })
    state.shared.mailbox = state.shared.mailbox.slice(-20)
  }
  if (patch.giftClaim?.id) state.shared.giftClaims[patch.giftClaim.id] = patch.giftClaim
  if (Array.isArray(patch.wishList)) {
    const items = Array.from(new Set(patch.wishList.map(item => cleanText(item, 40)).filter(Boolean))).slice(0, 5)
    state.shared.wishLists[userKey] = { ownerKey: userKey, ownerName: displayName, items, updatedAt: now }
  }
  if (patch.wishFulfillment) {
    const id = cleanId(patch.wishFulfillment.id)
    const item = cleanText(patch.wishFulfillment.item, 40)
    const ownerKey = cleanId(patch.wishFulfillment.ownerKey)
    const ownerName = cleanText(patch.wishFulfillment.ownerName || '伙伴', 20)
    const ownerList = (state.shared.wishLists[ownerKey] as { items?: unknown } | undefined)?.items
    const ownerItems = Array.isArray(ownerList) ? ownerList.map(value => String(value)) : []
    if (id && item && ownerKey && ownerKey !== userKey && !state.shared.wishFulfillments[id] && ownerItems.includes(item)) {
      state.shared.wishFulfillments[id] = {
        id,
        item,
        ownerKey,
        ownerName,
        fulfilledByKey: userKey,
        fulfilledByName: displayName,
        fulfilledAt: Number(patch.wishFulfillment.fulfilledAt || now),
        status: 'fulfilled',
        updatedAt: now,
      }
    }
  }
  if (patch.decorItem?.id) state.shared.decor[patch.decorItem.id] = { ...patch.decorItem, ownerKey: userKey, ownerName: displayName }
  if (patch.craftPlacement?.id) state.shared.placedCrafts.push({ ...patch.craftPlacement, ownerKey: userKey, ownerName: displayName })
  if (patch.craftPosition?.id) {
    const idx = state.shared.placedCrafts.findIndex((c: { id?: unknown }) => c?.id === patch.craftPosition!.id)
    if (idx >= 0) state.shared.placedCrafts[idx] = { ...state.shared.placedCrafts[idx], x: Number(patch.craftPosition.x) || 0, y: Number(patch.craftPosition.y) || 0, ownerKey: userKey, ownerName: displayName, updatedAt: Date.now() }
  }
  if (patch.buildingPosition?.id) state.shared.buildingPositions[patch.buildingPosition.id] = { x: Number(patch.buildingPosition.x) || 0, y: Number(patch.buildingPosition.y) || 0, ownerKey: userKey, ownerName: displayName, updatedAt: Date.now() }
  if (patch.weeklyEvent?.id) state.shared.events[patch.weeklyEvent.id] = { ...patch.weeklyEvent, createdBy: displayName }
}

function cleanText(value: unknown, maxLen: number) {
  return String(value || '').trim().replace(/\s+/gu, ' ').slice(0, maxLen)
}

function cleanId(value: unknown) {
  return String(value || '').replace(/[^a-zA-Z0-9_.%-]/g, '').slice(0, 96)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => { raw += chunk.toString('utf8') })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function sha256(value: string) {
  return Array.from(new Uint8Array(crypto.createHash('sha256').update(value).digest()))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}
