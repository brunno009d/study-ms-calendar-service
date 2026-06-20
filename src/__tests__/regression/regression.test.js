import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const mockSb = vi.hoisted(() => ({
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}))

vi.mock('../../config/supabase.js', () => ({ default: mockSb }))

import app from '../../app.js'

const TOKEN = 'Bearer test-token'
const USER_ID = 'test-user-id'

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockSb.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
})

describe('Regresión — bugs corregidos en calendar-service', () => {

  it('[BUG-001] createCalendar con título de solo espacios retorna 400 sin insertar en Supabase', async () => {
    // Bug: el service no hacía trim() al título; "   " pasaba como título válido
    // y se insertaba en la BD, rompiendo la UI que esperaba texto real.
    // Fix: title.trim() + validación de longitud > 0 antes del insert.
    const res = await request(app)
      .post('/')
      .set('Authorization', TOKEN)
      .send({ title: '   ' })

    expect(res.status).toBe(400)
    expect(mockSb.from).not.toHaveBeenCalled()
  })

  it('[BUG-002] createEvent en calendario ajeno retorna 403 sin crear el evento', async () => {
    // Bug: _verifyCalendarOwnership no existía; cualquier estudiante podía agregar
    // eventos al calendario de otro conociendo su ID.
    // Fix: verificar que calendar.student_id === userId antes del insert de evento.
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar') {
        // calendario existe pero pertenece a otro estudiante
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 1, title: 'Ajeno', student_id: 'otro-usuario' }, error: null,
        })
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }
      }
    })

    const res = await request(app)
      .post('/1/events')
      .set('Authorization', TOKEN)
      .send({ title: 'Evento', start_datetime: '2024-07-15T09:00:00' })

    expect(res.status).toBe(403)
    expect(mockSb.from).not.toHaveBeenCalledWith('calendar_event')
  })

  it('[BUG-003] updateEvent en evento ajeno retorna 403 sin modificar datos', async () => {
    // Bug: _verifyEventOwnership no existía; cualquier estudiante podía editar
    // eventos ajenos conociendo el ID del evento.
    // Fix: verificar event.calendar.student_id === userId (join con calendar).
    mockSb.from.mockImplementation((table) => {
      if (table === 'calendar_event') {
        // evento pertenece a un calendario de otro usuario
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 10, calendar: { student_id: 'otro-usuario' } }, error: null,
        })
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }
      }
    })

    const res = await request(app)
      .put('/events/10')
      .set('Authorization', TOKEN)
      .send({ title: 'Evento modificado' })

    expect(res.status).toBe(403)
    // maybeSingle fue el único call; update nunca se ejecutó
    expect(mockSb.from).toHaveBeenCalledTimes(1)
  })

  it('[BUG-004] createCalendar sin campo "title" retorna 400 sin tocar Supabase', async () => {
    // Bug: title undefined pasaba como string "undefined" al insert.
    // Fix: validación de campo requerido en el service.
    const res = await request(app)
      .post('/')
      .set('Authorization', TOKEN)
      .send({})

    expect(res.status).toBe(400)
    expect(mockSb.from).not.toHaveBeenCalled()
  })

})
