import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// ─── Mock supabase (requireAuth) ──────────────────────────────────────────────
const mockSb = vi.hoisted(() => ({ auth: { getUser: vi.fn() } }))
vi.mock('../../config/supabase.js', () => ({ default: mockSb }))

// ─── Mock servicio ────────────────────────────────────────────────────────────
vi.mock('../../service/calendarService.js', () => ({
  default: {
    getCalendars:   vi.fn(),
    createCalendar: vi.fn(),
    deleteCalendar: vi.fn(),
    getTodayEvents: vi.fn(),
    createEvent:    vi.fn(),
    updateEvent:    vi.fn(),
    deleteEvent:    vi.fn(),
    createReminder: vi.fn(),
  }
}))

import calendarService from '../../service/calendarService.js'
import app from '../../app.js'

const AUTH = { Authorization: 'Bearer test-token' }

beforeEach(() => {
  vi.clearAllMocks()
  mockSb.auth.getUser.mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null })
})

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth — rutas protegidas', () => {
  it('retorna 401 sin header de autorización', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error', 'unauthorized')
  })

  it('retorna 401 con token inválido', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Bad token') })
    const res = await request(app).get('/').set(AUTH)
    expect(res.status).toBe(401)
  })
})

// ─── GET / — calendarios ──────────────────────────────────────────────────────

describe('GET /', () => {
  it('retorna 200 con la lista de calendarios del usuario', async () => {
    calendarService.getCalendars.mockResolvedValue([{ id: 1, title: 'Personal' }])
    const res = await request(app).get('/').set(AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(calendarService.getCalendars).toHaveBeenCalledWith('test-user-id')
  })
})

// ─── POST / — crear calendario ────────────────────────────────────────────────

describe('POST /', () => {
  it('retorna 201 al crear el calendario', async () => {
    // Arrange
    calendarService.createCalendar.mockResolvedValue({ id: 2, title: 'Universidad' })
    // Act
    const res = await request(app).post('/').set(AUTH).send({ title: 'Universidad' })
    // Assert — controller pasa (userId, { title }), la validación de título vacío es del service
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id', 2)
    expect(calendarService.createCalendar).toHaveBeenCalledWith('test-user-id', { title: 'Universidad' })
  })
})

// ─── DELETE /:calendarId ───────────────────────────────────────────────────────

describe('DELETE /:calendarId', () => {
  it('retorna 204 al eliminar el calendario', async () => {
    calendarService.deleteCalendar.mockResolvedValue({ deleted: true })
    const res = await request(app).delete('/2').set(AUTH)
    // Controller: deleteCalendar(parseInt(calendarId), userId) → args invertidos respecto a lo intuitivo
    expect(res.status).toBe(204)
    expect(calendarService.deleteCalendar).toHaveBeenCalledWith(2, 'test-user-id')
  })
})

// ─── GET /all-events/today ────────────────────────────────────────────────────

describe('GET /all-events/today', () => {
  it('retorna 200 con los eventos de hoy', async () => {
    calendarService.getTodayEvents.mockResolvedValue([
      { id: 10, title: 'Prueba Cálculo', start_datetime: '2026-06-13T10:00:00' }
    ])
    const res = await request(app).get('/all-events/today').set(AUTH)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(calendarService.getTodayEvents).toHaveBeenCalledWith('test-user-id')
  })
})

// ─── POST /:calendarId/events ─────────────────────────────────────────────────

describe('POST /:calendarId/events', () => {
  it('retorna 400 cuando faltan campos obligatorios', async () => {
    const res = await request(app)
      .post('/2/events')
      .set(AUTH)
      .send({ title: 'Prueba' })               // falta start_datetime — validado en el controller
    expect(res.status).toBe(400)
  })

  it('retorna 201 al crear el evento', async () => {
    calendarService.createEvent.mockResolvedValue({
      id: 11, title: 'Prueba Cálculo', start_datetime: '2026-06-13T10:00:00'
    })
    const res = await request(app)
      .post('/2/events')
      .set(AUTH)
      .send({ title: 'Prueba Cálculo', start_datetime: '2026-06-13T10:00:00' })
    // Controller: createEvent(parseInt(calendarId), eventData, userId)
    expect(res.status).toBe(201)
    expect(calendarService.createEvent).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ title: 'Prueba Cálculo' }),
      'test-user-id'
    )
  })
})

// ─── PUT /events/:eventId ─────────────────────────────────────────────────────

describe('PUT /events/:eventId', () => {
  it('retorna 400 cuando el body está vacío', async () => {
    const res = await request(app).put('/events/11').set(AUTH).send({})
    expect(res.status).toBe(400)
  })

  it('retorna 200 al actualizar el evento', async () => {
    calendarService.updateEvent.mockResolvedValue({ id: 11, title: 'Actualizado' })
    const res = await request(app).put('/events/11').set(AUTH).send({ title: 'Actualizado' })
    // Controller: updateEvent(eventId, updateData, userId) — eventId es string desde params
    expect(res.status).toBe(200)
    expect(calendarService.updateEvent).toHaveBeenCalledWith(
      '11',
      expect.objectContaining({ title: 'Actualizado' }),
      'test-user-id'
    )
  })
})

// ─── POST /events/:eventId/reminders ──────────────────────────────────────────

describe('POST /events/:eventId/reminders', () => {
  it('retorna 201 al crear el recordatorio', async () => {
    calendarService.createReminder.mockResolvedValue({ id: 20, event_id: 11 })
    const res = await request(app)
      .post('/events/11/reminders')
      .set(AUTH)
      .send({ reminder_at: '2026-06-13T09:00:00' })
    // Controller: createReminder(eventId, userId, reminder_at) — eventId es string desde params
    expect(res.status).toBe(201)
    expect(calendarService.createReminder).toHaveBeenCalledWith(
      '11', 'test-user-id', '2026-06-13T09:00:00'
    )
  })
})
