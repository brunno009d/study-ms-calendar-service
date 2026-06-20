import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// ─── Mock Supabase — única dependencia externa ────────────────────────────────
const mockSb = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from:  vi.fn(),
}))
vi.mock('../../config/supabase.js', () => ({ default: mockSb }))

import app from '../../app.js'

const TOKEN = 'Bearer valid-test-token'

function makeQueryChain(resolvedValue) {
  const promise = Promise.resolve(resolvedValue)
  const chain = {
    single:      vi.fn().mockResolvedValue(resolvedValue),
    maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
    then:  promise.then.bind(promise),
    catch: promise.catch.bind(promise),
  }
  const builder = vi.fn().mockReturnValue(chain)
  chain.select = chain.insert = chain.update = chain.delete =
  chain.eq = chain.is = chain.in = chain.order = chain.gte = chain.lte = chain.or = builder
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockSb.auth.getUser.mockResolvedValue({
    data: { user: { id: 'test-user-id' } }, error: null,
  })
  // Por defecto responde vacío
  mockSb.from.mockReturnValue(makeQueryChain({ data: [], error: null }))
})

// ─── T6.1 — Autenticación y JWT ───────────────────────────────────────────────

describe('Seguridad — Autenticación y JWT', () => {
  it('401 — sin header Authorization retorna 401 sin revelar stack trace', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(401)
    expect(res.body).not.toHaveProperty('stack')
  })

  it('401 — JWT malformado retorna 401', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid JWT') })
    const res = await request(app).get('/').set('Authorization', 'Bearer BAD.TOKEN.HERE')
    expect(res.status).toBe(401)
    expect(res.body).not.toHaveProperty('stack')
  })

  it('401 — JWT con firma falsa retorna 401', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid signature') })
    const res = await request(app).get('/').set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.FAKESIG')
    expect(res.status).toBe(401)
  })

  it('401 — formato de token incorrecto retorna 401', async () => {
    const res = await request(app).get('/').set('Authorization', 'Token abc123')
    expect(res.status).toBe(401)
  })

  it('401 — token expirado retorna 401', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('JWT expired') })
    const res = await request(app).get('/').set('Authorization', TOKEN)
    expect(res.status).toBe(401)
  })
})

// ─── T6.2 — Inputs maliciosos ─────────────────────────────────────────────────

describe('Seguridad — Inputs maliciosos no provocan crash 500', () => {
  it('body vacío en POST / no provoca crash', async () => {
    const res = await request(app).post('/').set('Authorization', TOKEN).send({})
    expect(res.status).not.toBe(500)
  })

  it('título de calendario con 10.000 caracteres no provoca crash', async () => {
    const res = await request(app)
      .post('/')
      .set('Authorization', TOKEN)
      .send({ title: 'A'.repeat(10000) })
    expect(res.status).not.toBe(500)
  })

  it('calendarId SQL injection en URL no provoca crash', async () => {
    const res = await request(app)
      .delete("/'; DROP TABLE calendar;--")
      .set('Authorization', TOKEN)
    expect(res.status).not.toBe(500)
  })

  it('body con tipos incorrectos en POST evento no provoca crash', async () => {
    const res = await request(app)
      .post('/1/events')
      .set('Authorization', TOKEN)
      .send({
        title:          ['array'],
        start_datetime: null,
        end_datetime:   { nested: 'object' },
      })
    expect(res.status).not.toBe(500)
  })

  it('body vacío en POST reminder no provoca crash', async () => {
    // ownership chain para getEventById
    mockSb.from.mockReturnValueOnce(makeQueryChain({
      data: { id: 1, calendar: { student_id: 'test-user-id' } }, error: null,
    }))
    const res = await request(app)
      .post('/events/1/reminders')
      .set('Authorization', TOKEN)
      .send({})  // sin reminder_at
    expect(res.status).not.toBe(500)
  })
})

// ─── T6.3 — Respuestas seguras ────────────────────────────────────────────────

describe('Seguridad — Las respuestas no exponen información sensible', () => {
  it('error de Supabase no expone stack trace en el body', async () => {
    mockSb.from.mockReturnValue(makeQueryChain({ data: null, error: new Error('DB crashed') }))
    const res = await request(app).get('/').set('Authorization', TOKEN)
    expect(res.body).not.toHaveProperty('stack')
    expect(res.body).not.toHaveProperty('trace')
  })

  it('ruta no existente retorna 404 sin stack trace', async () => {
    const res = await request(app).get('/nonexistent/very/deep/path').set('Authorization', TOKEN)
    expect(res.status).toBe(404)
    expect(res.body).not.toHaveProperty('stack')
  })
})
