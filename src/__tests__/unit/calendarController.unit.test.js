import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../service/calendarService.js', () => ({
  default: {
    getCalendars: vi.fn(),
    createCalendar: vi.fn(),
    deleteCalendar: vi.fn(),
    getTodayEvents: vi.fn(),
    getEventsByCalendar: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    createReminder: vi.fn(),
  }
}))

import calendarService from '../../service/calendarService.js'
import controller from '../../controller/calendarController.js'

const mockRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.send = vi.fn().mockReturnValue(res)
  return res
}

beforeEach(() => vi.clearAllMocks())

// ─── getCalendars ─────────────────────────────────────────────────────────────

describe('calendarController — getCalendars', () => {
  it('responde 200 con la lista de calendarios', async () => {
    calendarService.getCalendars.mockResolvedValue([{ id: 1, title: 'Uni' }])
    const req = { userId: 'u1' }
    const res = mockRes()
    await controller.getCalendars(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith([{ id: 1, title: 'Uni' }])
  })
})

// ─── createCalendar ──────────────────────────────────────────────────────────

describe('calendarController — createCalendar', () => {
  it('responde 201 con el calendario creado', async () => {
    calendarService.createCalendar.mockResolvedValue({ id: 1, title: 'Uni' })
    const req = { userId: 'u1', body: { title: 'Uni' } }
    const res = mockRes()
    await controller.createCalendar(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
    expect(calendarService.createCalendar).toHaveBeenCalledWith('u1', { title: 'Uni' })
  })

  it('delega a next cuando el service lanza ValidationError', async () => {
    const err = new Error('El título es obligatorio')
    err.name = 'ValidationError'
    calendarService.createCalendar.mockRejectedValue(err)
    const req = { userId: 'u1', body: { title: '' } }
    const res = mockRes()
    const next = vi.fn()
    await controller.createCalendar(req, res, next)
    expect(next).toHaveBeenCalledWith(err)
  })
})

// ─── deleteCalendar ──────────────────────────────────────────────────────────

describe('calendarController — deleteCalendar', () => {
  it('responde 204 al eliminar exitosamente', async () => {
    calendarService.deleteCalendar.mockResolvedValue(undefined)
    const req = { userId: 'u1', params: { calendarId: '5' } }
    const res = mockRes()
    await controller.deleteCalendar(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(204)
    expect(calendarService.deleteCalendar).toHaveBeenCalledWith(5, 'u1')
  })
})

// ─── getTodayEvents ───────────────────────────────────────────────────────────

describe('calendarController — getTodayEvents', () => {
  it('responde 200 con los eventos de hoy', async () => {
    calendarService.getTodayEvents.mockResolvedValue([{ id: 'ev1' }])
    const req = { userId: 'u1' }
    const res = mockRes()
    await controller.getTodayEvents(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

// ─── createEvent ─────────────────────────────────────────────────────────────

describe('calendarController — createEvent', () => {
  it('responde 400 cuando faltan title o start_datetime', async () => {
    const req = {
      userId: 'u1',
      params: { calendarId: '1' },
      body: { title: 'Examen' } // sin start_datetime
    }
    const res = mockRes()
    await controller.createEvent(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/title.*start_datetime/i) }))
  })

  it('responde 201 con el evento creado y parsea calendarId a entero', async () => {
    const result = { event: { id: 'ev1' }, reminder: null }
    calendarService.createEvent.mockResolvedValue(result)
    const req = {
      userId: 'u1',
      params: { calendarId: '3' },
      body: { title: 'Examen', start_datetime: '2026-01-01T10:00:00Z' }
    }
    const res = mockRes()
    await controller.createEvent(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
    expect(calendarService.createEvent).toHaveBeenCalledWith(3, expect.any(Object), 'u1')
  })
})

// ─── updateEvent ─────────────────────────────────────────────────────────────

describe('calendarController — updateEvent', () => {
  it('responde 400 cuando el body está vacío', async () => {
    const req = { userId: 'u1', params: { eventId: 'ev1' }, body: {} }
    const res = mockRes()
    await controller.updateEvent(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('responde 200 con el evento actualizado', async () => {
    calendarService.updateEvent.mockResolvedValue({ id: 'ev1', title: 'Nuevo' })
    const req = { userId: 'u1', params: { eventId: 'ev1' }, body: { title: 'Nuevo' } }
    const res = mockRes()
    await controller.updateEvent(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

// ─── deleteEvent ─────────────────────────────────────────────────────────────

describe('calendarController — deleteEvent', () => {
  it('responde 204 al eliminar un evento', async () => {
    calendarService.deleteEvent.mockResolvedValue(undefined)
    const req = { userId: 'u1', params: { eventId: 'ev1' } }
    const res = mockRes()
    await controller.deleteEvent(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(204)
  })
})

// ─── createReminder ──────────────────────────────────────────────────────────

describe('calendarController — createReminder', () => {
  it('responde 201 con el recordatorio creado', async () => {
    calendarService.createReminder.mockResolvedValue({ id: 'rem1' })
    const req = {
      userId: 'u1',
      params: { eventId: 'ev1' },
      body: { reminder_at: '2026-01-01T09:00:00Z' }
    }
    const res = mockRes()
    await controller.createReminder(req, res, vi.fn())
    expect(res.status).toHaveBeenCalledWith(201)
    expect(calendarService.createReminder).toHaveBeenCalledWith('ev1', 'u1', '2026-01-01T09:00:00Z')
  })
})
