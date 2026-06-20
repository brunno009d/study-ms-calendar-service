import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../service/calendarService.js', () => ({
  default: { getCalendars: vi.fn() }
}))

vi.mock('../../repository/calendarRepository.js', () => ({
  default: { getEventsByCalendarId: vi.fn() }
}))

import calendarService    from '../../service/calendarService.js'
import calendarRepository from '../../repository/calendarRepository.js'
import { getContext }     from '../../controller/aiContextController.js'

const makeRes = () => {
  const res = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json   = vi.fn().mockReturnValue(res)
  return res
}

beforeEach(() => vi.clearAllMocks())

// ─── getContext ────────────────────────────────────────────────────────────────

describe('aiContextController — getContext', () => {
  it('200 — retorna calendarios y eventos próximos', async () => {
    // Arrange
    const calendars = [{ id: 1, title: 'Semestre 1' }]
    const events    = [{ id: 10, title: 'Prueba', start_datetime: '2026-06-25T10:00:00Z' }]
    calendarService.getCalendars.mockResolvedValue(calendars)
    calendarRepository.getEventsByCalendarId.mockResolvedValue(events)
    const req = { userId: 'u1' }
    const res = makeRes()
    // Act
    await getContext(req, res, vi.fn())
    // Assert
    expect(res.status).toHaveBeenCalledWith(200)
    const jsonArg = res.json.mock.calls[0][0]
    expect(jsonArg).toHaveProperty('calendars')
    expect(jsonArg).toHaveProperty('upcoming_events')
    expect(calendarRepository.getEventsByCalendarId).toHaveBeenCalledWith(
      1, expect.any(String), expect.any(String)
    )
  })

  it('200 — retorna estructura vacía cuando el estudiante no tiene calendarios', async () => {
    // Arrange
    calendarService.getCalendars.mockResolvedValue([])
    const req = { userId: 'u1' }
    const res = makeRes()
    // Act
    await getContext(req, res, vi.fn())
    // Assert
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ calendars: [], upcoming_events: [] })
    expect(calendarRepository.getEventsByCalendarId).not.toHaveBeenCalled()
  })

  it('añade calendar_title a cada evento', async () => {
    // Arrange
    const calendars = [{ id: 1, title: 'Clases' }]
    const events    = [{ id: 5, title: 'Taller', start_datetime: '2026-06-26T09:00:00Z' }]
    calendarService.getCalendars.mockResolvedValue(calendars)
    calendarRepository.getEventsByCalendarId.mockResolvedValue(events)
    const req = { userId: 'u1' }
    const res = makeRes()
    // Act
    await getContext(req, res, vi.fn())
    // Assert
    const { upcoming_events } = res.json.mock.calls[0][0]
    expect(upcoming_events[0]).toHaveProperty('calendar_title', 'Clases')
  })

  it('delega a next en error inesperado', async () => {
    // Arrange
    const err = new Error('fallo')
    calendarService.getCalendars.mockRejectedValue(err)
    const next = vi.fn()
    // Act
    await getContext({ userId: 'u1' }, makeRes(), next)
    // Assert
    expect(next).toHaveBeenCalledWith(err)
  })
})
