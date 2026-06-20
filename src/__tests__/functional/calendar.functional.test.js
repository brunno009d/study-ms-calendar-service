import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// ─── Mock Supabase — única dependencia externa ────────────────────────────────
const mockSb = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}))

vi.mock('../../config/supabase.js', () => ({ default: mockSb }))

import app from '../../app.js'

const TOKEN = 'Bearer test-token'
const USER_ID = 'test-user-id'

const CALENDAR = { id: 1, title: 'Mi Calendario', student_id: USER_ID }
const EVENT = {
  id: 10, calendar_id: 1, title: 'Examen Cálculo',
  start_datetime: '2024-07-15T09:00:00', event_type: 'exam',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockSb.auth.getUser.mockResolvedValue({
    data: { user: { id: USER_ID } }, error: null,
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Flujo 1: CRUD completo de calendario y evento
// ─────────────────────────────────────────────────────────────────────────────

describe('T4 — Flujo CRUD: crear calendario → evento → actualizar → eliminar', () => {
  it('el estudiante crea su calendario, agrega un evento y lo gestiona hasta eliminarlo', async () => {

    // ── Paso 1: Crear calendario ──────────────────────────────────────────────
    // Arrange: insert.select.single
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar') {
        const single = vi.fn().mockResolvedValue({ data: CALENDAR, error: null })
        return { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }) }
      }
    })
    // Act
    const createCal = await request(app)
      .post('/')
      .set('Authorization', TOKEN)
      .send({ title: 'Mi Calendario' })
    // Assert
    expect(createCal.status).toBe(201)
    expect(createCal.body).toMatchObject({ title: 'Mi Calendario', student_id: USER_ID })

    // ── Paso 2: Listar calendarios del estudiante ─────────────────────────────
    // Arrange: select.eq.order → array
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [CALENDAR], error: null }),
            }),
          }),
        }
      }
    })
    // Act
    const getCals = await request(app).get('/').set('Authorization', TOKEN)
    // Assert
    expect(getCals.status).toBe(200)
    expect(getCals.body).toHaveLength(1)
    expect(getCals.body[0]).toMatchObject({ id: 1, title: 'Mi Calendario' })

    // ── Paso 3: Crear evento en el calendario ─────────────────────────────────
    // Arrange: ownership check (calendar.maybeSingle) + event insert.select.single
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar') {
        const maybeSingle = vi.fn().mockResolvedValue({ data: CALENDAR, error: null })
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }
      }
      if (table === 'calendar_event') {
        const single = vi.fn().mockResolvedValue({ data: EVENT, error: null })
        return { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }) }
      }
    })
    // Act
    const createEv = await request(app)
      .post('/1/events')
      .set('Authorization', TOKEN)
      .send({ title: 'Examen Cálculo', start_datetime: '2024-07-15T09:00:00', event_type: 'exam' })
    // Assert — service envuelve el resultado en { event, reminder }
    expect(createEv.status).toBe(201)
    expect(createEv.body.event).toMatchObject({ title: 'Examen Cálculo' })
    expect(createEv.body.reminder).toBeNull()

    // ── Paso 4: Listar eventos del calendario ─────────────────────────────────
    // Arrange: ownership check + events select.eq.order
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar') {
        const maybeSingle = vi.fn().mockResolvedValue({ data: CALENDAR, error: null })
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }
      }
      if (table === 'calendar_event') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [EVENT], error: null }),
            }),
          }),
        }
      }
    })
    // Act
    const getEvents = await request(app).get('/1/events').set('Authorization', TOKEN)
    // Assert
    expect(getEvents.status).toBe(200)
    expect(getEvents.body).toHaveLength(1)
    expect(getEvents.body[0]).toMatchObject({ id: 10, title: 'Examen Cálculo' })

    // ── Paso 5: Actualizar el evento ──────────────────────────────────────────
    // Arrange: ownership check del evento (select join) + update.eq.select.single
    const UPDATED_EVENT = { ...EVENT, title: 'Examen Final Cálculo' }
    let eventCallCount = 0
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar_event') {
        eventCallCount++
        if (eventCallCount === 1) {
          // _verifyEventOwnership: select('*, calendar!inner(student_id)').eq().maybeSingle()
          const maybeSingle = vi.fn().mockResolvedValue({
            data: { ...EVENT, calendar: { student_id: USER_ID } }, error: null,
          })
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }
        }
        // updateEvent: update.eq.select.single
        const single = vi.fn().mockResolvedValue({ data: UPDATED_EVENT, error: null })
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
          }),
        }
      }
    })
    // Act
    const updateEv = await request(app)
      .put('/events/10')
      .set('Authorization', TOKEN)
      .send({ title: 'Examen Final Cálculo' })
    // Assert
    expect(updateEv.status).toBe(200)
    expect(updateEv.body).toMatchObject({ title: 'Examen Final Cálculo' })

    // ── Paso 6: Eliminar el evento ────────────────────────────────────────────
    // Arrange: ownership check + delete.eq
    eventCallCount = 0
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar_event') {
        eventCallCount++
        if (eventCallCount === 1) {
          const maybeSingle = vi.fn().mockResolvedValue({
            data: { ...EVENT, calendar: { student_id: USER_ID } }, error: null,
          })
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }
        }
        return { delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
    })
    // Act
    const delEv = await request(app).delete('/events/10').set('Authorization', TOKEN)
    // Assert
    expect(delEv.status).toBe(204)

    // ── Paso 7: Eliminar el calendario ────────────────────────────────────────
    // Arrange: ownership check + delete.eq
    let calCallCount = 0
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar') {
        calCallCount++
        if (calCallCount === 1) {
          const maybeSingle = vi.fn().mockResolvedValue({ data: CALENDAR, error: null })
          return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }
        }
        return { delete: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) }
      }
    })
    // Act
    const delCal = await request(app).delete('/1').set('Authorization', TOKEN)
    // Assert
    expect(delCal.status).toBe(204)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Flujo 2: Validaciones de negocio
// ─────────────────────────────────────────────────────────────────────────────

describe('T4 — Flujo: validaciones de negocio bloquean operaciones inválidas', () => {
  it('el service rechaza calendario sin título y acceso a calendario ajeno', async () => {

    // ── Paso 1: Crear calendario sin título → service rechaza antes de Supabase
    const noTitle = await request(app)
      .post('/')
      .set('Authorization', TOKEN)
      .send({ title: '   ' })  // solo espacios → trim vacío
    expect(noTitle.status).toBe(400)
    expect(mockSb.from).not.toHaveBeenCalled()

    // ── Paso 2: Crear evento en un calendario ajeno → service rechaza (403)
    vi.clearAllMocks()
    mockSb.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar') {
        // calendario existe pero pertenece a otro usuario
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 1, title: 'Ajeno', student_id: 'otro-usuario' }, error: null,
        })
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }
      }
    })
    const forbidden = await request(app)
      .post('/1/events')
      .set('Authorization', TOKEN)
      .send({ title: 'Evento', start_datetime: '2024-07-15T09:00:00' })
    expect(forbidden.status).toBe(403)
    // la creación del evento (calendar_event) nunca se ejecutó
    expect(mockSb.from).not.toHaveBeenCalledWith('calendar_event')
  })
})
