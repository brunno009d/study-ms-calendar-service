import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../repository/calendarRepository.js', () => ({
  default: {
    getCalendarsByStudentId: vi.fn(),
    getCalendarById: vi.fn(),
    createCalendar: vi.fn(),
    deleteCalendar: vi.fn(),
    getEventsByCalendarId: vi.fn(),
    getTodayEventsForCalendars: vi.fn(),
    getEventById: vi.fn(),
    createEvent: vi.fn(),
    createReminder: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  }
}))

import calendarRepository from '../../repository/calendarRepository.js'
import calendarService from '../../service/calendarService.js'

beforeEach(() => vi.clearAllMocks())

// ─── createCalendar ──────────────────────────────────────────────────────────

describe('calendarService — createCalendar', () => {
  it('lanza ValidationError cuando el título está vacío', async () => {
    const err = await calendarService.createCalendar('s1', { title: '' }).catch(e => e)
    expect(err.name).toBe('ValidationError')
    expect(err.message).toMatch(/título/)
  })

  it('lanza ValidationError cuando el título es solo espacios', async () => {
    const err = await calendarService.createCalendar('s1', { title: '   ' }).catch(e => e)
    expect(err.name).toBe('ValidationError')
  })

  it('trimea el título y delega al repository', async () => {
    // Arrange
    calendarRepository.createCalendar.mockResolvedValue({ id: 'cal1', title: 'Mis eventos' })
    // Act
    const result = await calendarService.createCalendar('s1', { title: '  Mis eventos  ' })
    // Assert
    expect(calendarRepository.createCalendar).toHaveBeenCalledWith('s1', 'Mis eventos')
    expect(result.id).toBe('cal1')
  })
})

// ─── deleteCalendar ──────────────────────────────────────────────────────────

describe('calendarService — deleteCalendar', () => {
  it('lanza 404 cuando el calendario no existe', async () => {
    calendarRepository.getCalendarById.mockResolvedValue(null)
    const err = await calendarService.deleteCalendar('cal1', 's1').catch(e => e)
    expect(err.status).toBe(404)
  })

  it('lanza 403 cuando el calendario no pertenece al estudiante', async () => {
    calendarRepository.getCalendarById.mockResolvedValue({ id: 'cal1', student_id: 'otro' })
    const err = await calendarService.deleteCalendar('cal1', 's1').catch(e => e)
    expect(err.status).toBe(403)
  })

  it('elimina cuando el estudiante es dueño', async () => {
    calendarRepository.getCalendarById.mockResolvedValue({ id: 'cal1', student_id: 's1' })
    calendarRepository.deleteCalendar.mockResolvedValue(undefined)
    await calendarService.deleteCalendar('cal1', 's1')
    expect(calendarRepository.deleteCalendar).toHaveBeenCalledWith('cal1')
  })
})

// ─── getTodayEvents ───────────────────────────────────────────────────────────

describe('calendarService — getTodayEvents', () => {
  it('retorna array vacío cuando el estudiante no tiene calendarios', async () => {
    calendarRepository.getCalendarsByStudentId.mockResolvedValue([])
    const result = await calendarService.getTodayEvents('s1')
    expect(result).toEqual([])
    expect(calendarRepository.getTodayEventsForCalendars).not.toHaveBeenCalled()
  })

  it('consulta eventos del día para los calendarios del estudiante', async () => {
    // Arrange
    calendarRepository.getCalendarsByStudentId.mockResolvedValue([
      { id: 'cal1' }, { id: 'cal2' }
    ])
    calendarRepository.getTodayEventsForCalendars.mockResolvedValue([{ id: 'ev1' }])
    // Act
    const result = await calendarService.getTodayEvents('s1')
    // Assert
    expect(calendarRepository.getTodayEventsForCalendars).toHaveBeenCalledWith(['cal1', 'cal2'])
    expect(result).toHaveLength(1)
  })
})

// ─── createEvent ─────────────────────────────────────────────────────────────

describe('calendarService — createEvent', () => {
  beforeEach(() => {
    calendarRepository.getCalendarById.mockResolvedValue({ id: 'cal1', student_id: 's1' })
  })

  it('lanza ValidationError cuando falta el título del evento', async () => {
    const err = await calendarService
      .createEvent('cal1', { title: '', start_datetime: '2026-01-01T10:00:00Z' }, 's1')
      .catch(e => e)
    expect(err.name).toBe('ValidationError')
    expect(err.message).toMatch(/título/)
  })

  it('lanza ValidationError cuando falta start_datetime', async () => {
    const err = await calendarService
      .createEvent('cal1', { title: 'Examen' }, 's1')
      .catch(e => e)
    expect(err.name).toBe('ValidationError')
    expect(err.message).toMatch(/start_datetime/)
  })

  it('crea el evento sin reminder cuando no se envía reminder_at', async () => {
    // Arrange
    calendarRepository.createEvent.mockResolvedValue({ id: 'ev1', title: 'Examen' })
    // Act
    const result = await calendarService.createEvent(
      'cal1',
      { title: 'Examen', start_datetime: '2026-01-01T10:00:00Z' },
      's1'
    )
    // Assert
    expect(calendarRepository.createReminder).not.toHaveBeenCalled()
    expect(result).toEqual({ event: { id: 'ev1', title: 'Examen' }, reminder: null })
  })

  it('crea reminder cuando se envía reminder_at', async () => {
    // Arrange
    calendarRepository.createEvent.mockResolvedValue({ id: 'ev1' })
    calendarRepository.createReminder.mockResolvedValue({ id: 'rem1' })
    // Act
    const result = await calendarService.createEvent(
      'cal1',
      { title: 'Examen', start_datetime: '2026-01-01T10:00:00Z', reminder_at: '2026-01-01T09:00:00Z' },
      's1'
    )
    // Assert
    expect(calendarRepository.createReminder).toHaveBeenCalledWith('s1', 'ev1', '2026-01-01T09:00:00Z')
    expect(result.reminder).toEqual({ id: 'rem1' })
  })
})

// ─── updateEvent ─────────────────────────────────────────────────────────────

describe('calendarService — updateEvent', () => {
  beforeEach(() => {
    calendarRepository.getEventById.mockResolvedValue({
      id: 'ev1',
      calendar: { student_id: 's1' }
    })
  })

  it('lanza ValidationError cuando no se envían campos válidos', async () => {
    const err = await calendarService
      .updateEvent('ev1', { campo_invalido: 'x' }, 's1')
      .catch(e => e)
    expect(err.name).toBe('ValidationError')
    expect(err.message).toMatch(/campos válidos/)
  })

  it('filtra campos no permitidos y llama al repository', async () => {
    // Arrange
    calendarRepository.updateEvent.mockResolvedValue({ id: 'ev1', title: 'Nuevo título' })
    // Act
    await calendarService.updateEvent('ev1', { title: 'Nuevo título', hack: 'evil' }, 's1')
    // Assert
    expect(calendarRepository.updateEvent).toHaveBeenCalledWith('ev1', { title: 'Nuevo título' })
  })
})

// ─── createReminder ──────────────────────────────────────────────────────────

describe('calendarService — createReminder', () => {
  it('lanza ValidationError cuando falta reminderAt', async () => {
    calendarRepository.getEventById.mockResolvedValue({ id: 'ev1', calendar: { student_id: 's1' } })
    const err = await calendarService.createReminder('ev1', 's1', null).catch(e => e)
    expect(err.name).toBe('ValidationError')
    expect(err.message).toMatch(/reminder_at/)
  })

  it('lanza 403 cuando el evento no pertenece al estudiante', async () => {
    calendarRepository.getEventById.mockResolvedValue({ id: 'ev1', calendar: { student_id: 'otro' } })
    const err = await calendarService.createReminder('ev1', 's1', '2026-01-01T09:00:00Z').catch(e => e)
    expect(err.status).toBe(403)
  })
})
