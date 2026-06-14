/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), legacyDevApi()],
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
  const root = path.resolve(__dirname, '..')
  const dataDir = path.join(root, 'data')
  const fixedUsers = ['哥哥', '乖宝']

  return {
    name: 'legacy-dev-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/plan.json', (_req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        fs.createReadStream(path.join(root, 'plan.json')).pipe(res)
      })

      server.middlewares.use('/assets', (req: IncomingMessage, res: ServerResponse) => {
        const requested = decodeURIComponent(req.url || '/').replace(/^\/+/, '')
        const file = path.join(root, 'assets', requested)
        if (!file.startsWith(path.join(root, 'assets')) || !fs.existsSync(file)) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        fs.createReadStream(file).pipe(res)
      })

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
    },
  }
}

function readState(file: string, room: string) {
  if (!fs.existsSync(file)) {
    return { ok: true, version: 1, room, updatedAt: 0, users: {}, shared: { giftClaims: {}, wishLists: {}, wishFulfillments: {}, mailbox: [], events: {}, decor: {} } }
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
  return state
}

function mergeShared(state: any, patch: any, userKey: string, displayName: string) {
  if (!patch) return
  if (patch.mailboxEntry?.text) {
    state.shared.mailbox.push({
      id: String(patch.mailboxEntry.id || `mail_${Date.now()}`),
      authorKey: userKey,
      authorName: displayName,
      text: String(patch.mailboxEntry.text).trim().slice(0, 80),
      createdAt: Number(patch.mailboxEntry.createdAt || Date.now()),
    })
    state.shared.mailbox = state.shared.mailbox.slice(-20)
  }
  if (patch.giftClaim?.id) state.shared.giftClaims[patch.giftClaim.id] = patch.giftClaim
  if (patch.wishList) state.shared.wishLists[userKey] = { ownerKey: userKey, ownerName: displayName, items: patch.wishList, updatedAt: Date.now() }
  if (patch.decorItem?.id) state.shared.decor[patch.decorItem.id] = { ...patch.decorItem, ownerKey: userKey, ownerName: displayName }
  if (patch.weeklyEvent?.id) state.shared.events[patch.weeklyEvent.id] = { ...patch.weeklyEvent, createdBy: displayName }
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk: Buffer) => { raw += chunk.toString('utf8') })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function sendJson(res: any, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function sha256(value: string) {
  return Array.from(new Uint8Array(crypto.createHash('sha256').update(value).digest()))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}
