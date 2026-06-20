import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// ─── Mock Supabase — ÚNICA dependencia externa ────────────────────────────────
// Todo el código real de controller → service → repository se ejecuta sin cambios.
// Solo el cliente de Supabase está mockeado.
const mockSb = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from:  vi.fn(),
}))

vi.mock('../../config/supabase.js', () => ({ default: mockSb }))

import app from '../../app.js'

const TOKEN = 'Bearer test-token'
const USER_ID = 'test-user-id'

// ─── Helper makeQueryChain ────────────────────────────────────────────────────
//
// El repositorio del calendar tiene dos tipos de terminación:
//   - .single() / .maybeSingle()  → queries puntuales (getById, create, update)
//   - await directo en la cadena  → queries de lista (getCalendarsByStudentId,
//     getEventsByCalendarId, etc.) que terminan con .order(), .gte(), .lte()
//
// El chain es thenable para soportar ambos casos.

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

  // Auth válida por defecto
  mockSb.auth.getUser.mockResolvedValue({
    data: { user: { id: USER_ID } }, error: null,
  })
})

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth — middleware chain', () => {
  it('401 — sin header la petición no llega al controller ni a supabase.from', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(401)
    expect(res.body).toHaveProperty('error', 'unauthorized')
    expect(mockSb.from).not.toHaveBeenCalled()
  })

  it('401 — con token inválido: Supabase auth rechaza y nada más se ejecuta', async () => {
    mockSb.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Token inválido') })
    const res = await request(app).get('/').set('Authorization', TOKEN)
    expect(res.status).toBe(401)
    expect(mockSb.from).not.toHaveBeenCalled()
  })
})

// ─── GET / — calendarios ──────────────────────────────────────────────────────

describe('GET /', () => {
  it('200 — cadena completa: requireAuth → service → repository → supabase.from(calendar)', async () => {
    // Arrange — getCalendarsByStudentId (await directo en la lista)
    const listChain = makeQueryChain({ data: [{ id: 1, title: 'Personal', student_id: USER_ID }], error: null })
    mockSb.from.mockReturnValueOnce(listChain)

    // Act
    const res = await request(app).get('/').set('Authorization', TOKEN)

    // Assert — Supabase fue consultado con la tabla correcta
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ id: 1, title: 'Personal' })
    expect(mockSb.from).toHaveBeenCalledWith('calendar')
  })
})

// ─── POST / — crear calendario ────────────────────────────────────────────────

describe('POST /', () => {
  it('201 — service valida título y repository inserta en BD', async () => {
    // Arrange
    const insertChain = makeQueryChain({ data: { id: 2, title: 'Universidad', student_id: USER_ID }, error: null })
    mockSb.from.mockReturnValueOnce(insertChain)

    // Act
    const res = await request(app).post('/').set('Authorization', TOKEN).send({ title: 'Universidad' })

    // Assert — insert llegó a Supabase con la tabla correcta
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 2, title: 'Universidad' })
    expect(mockSb.from).toHaveBeenCalledWith('calendar')
  })

  it('400 — service rechaza título vacío antes de tocar supabase.from', async () => {
    const res = await request(app).post('/').set('Authorization', TOKEN).send({ title: '   ' })

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'validation_error')
    expect(mockSb.from).not.toHaveBeenCalled()
  })
})

// ─── DELETE /:calendarId ───────────────────────────────────────────────────────

describe('DELETE /:calendarId', () => {
  it('204 — service verifica ownership y repository elimina el calendario', async () => {
    // Arrange — getCalendarById (ownership check) y deleteCalendar
    const getByIdChain = makeQueryChain({ data: { id: 2, student_id: USER_ID }, error: null })
    const deleteChain  = makeQueryChain({ data: null, error: null })

    mockSb.from
      .mockReturnValueOnce(getByIdChain)  // getCalendarById → maybeSingle
      .mockReturnValueOnce(deleteChain)   // deleteCalendar → delete

    // Act
    const res = await request(app).delete('/2').set('Authorization', TOKEN)

    // Assert — el flujo completo llegó a Supabase
    expect(res.status).toBe(204)
    expect(mockSb.from).toHaveBeenCalledWith('calendar')
  })

  it('403 — service rechaza eliminar calendario de otro usuario sin llamar a delete', async () => {
    // Arrange — calendario existe pero pertenece a otro
    const getByIdChain = makeQueryChain({ data: { id: 2, student_id: 'otro-user' }, error: null })
    mockSb.from.mockReturnValueOnce(getByIdChain)

    const res = await request(app).delete('/2').set('Authorization', TOKEN)

    expect(res.status).toBe(403)
    // Solo un from() — el delete nunca se ejecuta
    expect(mockSb.from).toHaveBeenCalledTimes(1)
  })

  it('404 — service lanza 404 cuando el calendario no existe', async () => {
    const getByIdChain = makeQueryChain({ data: null, error: null })
    mockSb.from.mockReturnValueOnce(getByIdChain)

    const res = await request(app).delete('/999').set('Authorization', TOKEN)

    expect(res.status).toBe(404)
    expect(mockSb.from).toHaveBeenCalledTimes(1)
  })
})

// ─── GET /all-events/today ────────────────────────────────────────────────────

describe('GET /all-events/today', () => {
  it('200 — service busca calendarios del usuario y luego eventos de hoy', async () => {
    // Arrange — getCalendarsByStudentId → getTodayEventsForCalendars
    const calendarsChain = makeQueryChain({ data: [{ id: 1, student_id: USER_ID }], error: null })
    const eventsChain    = makeQueryChain({ data: [{ id: 10, title: 'Prueba Cálculo' }], error: null })

    mockSb.from
      .mockReturnValueOnce(calendarsChain)  // getCalendarsByStudentId
      .mockReturnValueOnce(eventsChain)     // getTodayEventsForCalendars

    // Act
    const res = await request(app).get('/all-events/today').set('Authorization', TOKEN)

    // Assert — cadena completa llegó hasta Supabase dos veces
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(mockSb.from).toHaveBeenCalledWith('calendar')
    expect(mockSb.from).toHaveBeenCalledWith('calendar_event')
  })

  it('200 — retorna arreglo vacío cuando el usuario no tiene calendarios (no consulta eventos)', async () => {
    // Arrange — lista de calendarios vacía → service retorna [] sin llamar a getTodayEvents
    const calendarsChain = makeQueryChain({ data: [], error: null })
    mockSb.from.mockReturnValueOnce(calendarsChain)

    const res = await request(app).get('/all-events/today').set('Authorization', TOKEN)

    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
    // Solo se consulta calendar, nunca calendar_event
    expect(mockSb.from).toHaveBeenCalledTimes(1)
    expect(mockSb.from).toHaveBeenCalledWith('calendar')
  })
})

// ─── GET /:calendarId/events ───────────────────────────────────────────────────

describe('GET /:calendarId/events', () => {
  it('200 — service verifica ownership y devuelve los eventos del calendario', async () => {
    // Arrange — ownership check + lista de eventos
    const ownershipChain = makeQueryChain({ data: { id: 3, student_id: USER_ID }, error: null })
    const eventsChain    = makeQueryChain({ data: [{ id: 20, title: 'Clase Física' }], error: null })

    mockSb.from
      .mockReturnValueOnce(ownershipChain)
      .mockReturnValueOnce(eventsChain)

    // Act
    const res = await request(app).get('/3/events').set('Authorization', TOKEN)

    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(mockSb.from).toHaveBeenCalledWith('calendar')
    expect(mockSb.from).toHaveBeenCalledWith('calendar_event')
  })

  it('403 — service rechaza acceso a eventos de calendario ajeno', async () => {
    const ownershipChain = makeQueryChain({ data: { id: 3, student_id: 'otro-user' }, error: null })
    mockSb.from.mockReturnValueOnce(ownershipChain)

    const res = await request(app).get('/3/events').set('Authorization', TOKEN)

    expect(res.status).toBe(403)
    expect(mockSb.from).toHaveBeenCalledTimes(1)
  })
})

// ─── POST /:calendarId/events ─────────────────────────────────────────────────

describe('POST /:calendarId/events', () => {
  it('400 — controller bloquea body sin title antes de llegar a Supabase', async () => {
    const res = await request(app)
      .post('/2/events')
      .set('Authorization', TOKEN)
      .send({ start_datetime: '2026-06-13T10:00:00' })  // falta title

    expect(res.status).toBe(400)
    expect(mockSb.from).not.toHaveBeenCalled()
  })

  it('400 — controller bloquea body sin start_datetime antes de llegar a Supabase', async () => {
    const res = await request(app)
      .post('/2/events')
      .set('Authorization', TOKEN)
      .send({ title: 'Prueba' })  // falta start_datetime

    expect(res.status).toBe(400)
    expect(mockSb.from).not.toHaveBeenCalled()
  })

  it('201 — service verifica ownership, repository inserta evento en BD', async () => {
    // Arrange — ownership check + insert evento
    const ownershipChain = makeQueryChain({ data: { id: 2, student_id: USER_ID }, error: null })
    const insertChain    = makeQueryChain({ data: { id: 11, title: 'Prueba Cálculo', calendar_id: 2 }, error: null })

    mockSb.from
      .mockReturnValueOnce(ownershipChain)  // getCalendarById
      .mockReturnValueOnce(insertChain)     // createEvent → insert

    // Act
    const res = await request(app)
      .post('/2/events')
      .set('Authorization', TOKEN)
      .send({ title: 'Prueba Cálculo', start_datetime: '2026-06-13T10:00:00' })

    // Assert — el insert llegó a Supabase con la tabla correcta
    expect(res.status).toBe(201)
    expect(res.body.event).toMatchObject({ id: 11, title: 'Prueba Cálculo' })
    expect(mockSb.from).toHaveBeenCalledWith('calendar_event')
  })
})

// ─── PUT /events/:eventId ─────────────────────────────────────────────────────

describe('PUT /events/:eventId', () => {
  it('400 — controller bloquea body vacío antes de llegar a Supabase', async () => {
    const res = await request(app).put('/events/11').set('Authorization', TOKEN).send({})

    expect(res.status).toBe(400)
    expect(mockSb.from).not.toHaveBeenCalled()
  })

  it('200 — service verifica event ownership y filtra campos no permitidos', async () => {
    // Arrange — getEventById (ownership) + updateEvent
    const ownershipChain = makeQueryChain({
      data: { id: 11, calendar: { student_id: USER_ID } }, error: null,
    })
    const updateChain = makeQueryChain({ data: { id: 11, title: 'Actualizado' }, error: null })

    // Spy para capturar qué datos recibe el update
    let capturedUpdateData
    const spyUpdateChain = {
      ...updateChain,
      update: vi.fn().mockImplementation((data) => {
        capturedUpdateData = data
        return updateChain
      }),
    }

    mockSb.from
      .mockReturnValueOnce(ownershipChain)  // getEventById → maybeSingle
      .mockReturnValueOnce(spyUpdateChain)  // updateEvent → update

    // Act
    const res = await request(app)
      .put('/events/11')
      .set('Authorization', TOKEN)
      .send({ title: 'Actualizado', campo_hack: 'evil' })

    // Assert — solo los campos permitidos llegaron a Supabase
    expect(res.status).toBe(200)
    expect(capturedUpdateData).toEqual({ title: 'Actualizado' })
    expect(capturedUpdateData).not.toHaveProperty('campo_hack')
    expect(mockSb.from).toHaveBeenCalledWith('calendar_event')
  })

  it('403 — service rechaza actualizar evento ajeno sin llamar a update', async () => {
    const ownershipChain = makeQueryChain({
      data: { id: 11, calendar: { student_id: 'otro-user' } }, error: null,
    })
    mockSb.from.mockReturnValueOnce(ownershipChain)

    const res = await request(app).put('/events/11').set('Authorization', TOKEN).send({ title: 'X' })

    expect(res.status).toBe(403)
    expect(mockSb.from).toHaveBeenCalledTimes(1)
  })
})

// ─── DELETE /events/:eventId ───────────────────────────────────────────────────

describe('DELETE /events/:eventId', () => {
  it('204 — service verifica event ownership y repository elimina el evento', async () => {
    const ownershipChain = makeQueryChain({
      data: { id: 11, calendar: { student_id: USER_ID } }, error: null,
    })
    const deleteChain = makeQueryChain({ data: null, error: null })

    mockSb.from
      .mockReturnValueOnce(ownershipChain)
      .mockReturnValueOnce(deleteChain)

    const res = await request(app).delete('/events/11').set('Authorization', TOKEN)

    expect(res.status).toBe(204)
    expect(mockSb.from).toHaveBeenCalledWith('calendar_event')
  })

  it('404 — service lanza 404 cuando el evento no existe', async () => {
    const ownershipChain = makeQueryChain({ data: null, error: null })
    mockSb.from.mockReturnValueOnce(ownershipChain)

    const res = await request(app).delete('/events/999').set('Authorization', TOKEN)

    expect(res.status).toBe(404)
    expect(mockSb.from).toHaveBeenCalledTimes(1)
  })
})

// ─── POST /events/:eventId/reminders ──────────────────────────────────────────

describe('POST /events/:eventId/reminders', () => {
  it('201 — service verifica event ownership y repository inserta el recordatorio', async () => {
    // Arrange — ownership del evento + insert recordatorio
    const ownershipChain = makeQueryChain({
      data: { id: 11, calendar: { student_id: USER_ID } }, error: null,
    })
    const insertReminderChain = makeQueryChain({
      data: { id: 20, event_id: 11, reminder_at: '2026-06-13T09:00:00', sent: false },
      error: null,
    })

    mockSb.from
      .mockReturnValueOnce(ownershipChain)       // getEventById
      .mockReturnValueOnce(insertReminderChain)  // createReminder → insert

    // Act
    const res = await request(app)
      .post('/events/11/reminders')
      .set('Authorization', TOKEN)
      .send({ reminder_at: '2026-06-13T09:00:00' })

    // Assert — el insert llegó a la tabla de recordatorios
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ id: 20, event_id: 11 })
    expect(mockSb.from).toHaveBeenCalledWith('event_reminders')
  })

  it('400 — service rechaza reminder sin reminder_at antes de insertar', async () => {
    // Arrange — ownership pasa, pero service lanza ValidationError
    const ownershipChain = makeQueryChain({
      data: { id: 11, calendar: { student_id: USER_ID } }, error: null,
    })
    mockSb.from.mockReturnValueOnce(ownershipChain)

    const res = await request(app)
      .post('/events/11/reminders')
      .set('Authorization', TOKEN)
      .send({})  // falta reminder_at

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error', 'validation_error')
    // Solo un from() — el insert de event_reminders nunca se ejecuta
    expect(mockSb.from).toHaveBeenCalledTimes(1)
  })
})
