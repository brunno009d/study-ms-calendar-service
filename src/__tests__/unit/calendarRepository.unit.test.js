import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

import calendarRepository from '../../repository/calendarRepository.js'

const mockChain = (finalValue) => {
  const chain = {
    then: (resolve, reject) => Promise.resolve(finalValue).then(resolve, reject),
  }
  ;['select', 'update', 'insert', 'delete', 'eq', 'in', 'is', 'order', 'gte', 'lte'].forEach(
    (m) => { chain[m] = vi.fn().mockReturnValue(chain) }
  )
  chain.single      = vi.fn().mockResolvedValue(finalValue)
  chain.maybeSingle = vi.fn().mockResolvedValue(finalValue)
  return chain
}

beforeEach(() => vi.clearAllMocks())

// ─── getCalendarsByStudentId ───────────────────────────────────────────────

describe('calendarRepository — getCalendarsByStudentId', () => {
  it('retorna los calendarios del estudiante', async () => {
    // Arrange
    const fakeCalendars = [{ id: 1, title: 'Semestre 1', student_id: 'u1' }]
    mockSupabase.from.mockReturnValue(mockChain({ data: fakeCalendars, error: null }))

    // Act
    const result = await calendarRepository.getCalendarsByStudentId('u1')

    // Assert
    expect(result).toEqual(fakeCalendars)
    expect(mockSupabase.from).toHaveBeenCalledWith('calendar')
  })

  it('retorna arreglo vacío cuando data es null', async () => {
    // Arrange
    mockSupabase.from.mockReturnValue(mockChain({ data: null, error: null }))

    // Act
    const result = await calendarRepository.getCalendarsByStudentId('u1')

    // Assert
    expect(result).toEqual([])
  })
})

// ─── createCalendar ────────────────────────────────────────────────────────

describe('calendarRepository — createCalendar', () => {
  it('retorna el calendario creado', async () => {
    // Arrange
    const created = { id: 2, student_id: 'u1', title: 'Semestre 2' }
    mockSupabase.from.mockReturnValue(mockChain({ data: created, error: null }))

    // Act
    const result = await calendarRepository.createCalendar('u1', 'Semestre 2')

    // Assert
    expect(result).toEqual(created)
  })

  it('lanza error cuando falla la creación', async () => {
    // Arrange
    mockSupabase.from.mockReturnValue(mockChain({ data: null, error: new Error('Falla en insert') }))

    // Act & Assert
    await expect(calendarRepository.createCalendar('u1', 'test')).rejects.toThrow('Falla en insert')
  })
})

// ─── deleteCalendar ────────────────────────────────────────────────────────

describe('calendarRepository — deleteCalendar', () => {
  it('retorna true al eliminar exitosamente', async () => {
    // Arrange
    mockSupabase.from.mockReturnValue(mockChain({ error: null }))

    // Act
    const result = await calendarRepository.deleteCalendar(1)

    // Assert
    expect(result).toBe(true)
  })
})

// ─── getEventsByCalendarId ────────────────────────────────────────────────

describe('calendarRepository — getEventsByCalendarId', () => {
  it('retorna eventos del calendario', async () => {
    // Arrange
    const fakeEvents = [{ id: 1, title: 'Examen', calendar_id: 1 }]
    mockSupabase.from.mockReturnValue(mockChain({ data: fakeEvents, error: null }))

    // Act
    const result = await calendarRepository.getEventsByCalendarId(1)

    // Assert
    expect(result).toEqual(fakeEvents)
    expect(mockSupabase.from).toHaveBeenCalledWith('calendar_event')
  })

  it('retorna arreglo vacío cuando no hay eventos', async () => {
    // Arrange
    mockSupabase.from.mockReturnValue(mockChain({ data: null, error: null }))

    // Act
    const result = await calendarRepository.getEventsByCalendarId(1)

    // Assert
    expect(result).toEqual([])
  })
})

// ─── getTodayEventsForCalendars ────────────────────────────────────────────

describe('calendarRepository — getTodayEventsForCalendars', () => {
  it('retorna arreglo vacío sin consultar BD cuando no hay calendarios', async () => {
    // Act
    const result = await calendarRepository.getTodayEventsForCalendars([])

    // Assert
    expect(result).toEqual([])
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('consulta BD y retorna los eventos de hoy', async () => {
    // Arrange
    const fakeEvents = [{ id: 5, title: 'Reunión', calendar_id: 1 }]
    mockSupabase.from.mockReturnValue(mockChain({ data: fakeEvents, error: null }))

    // Act
    const result = await calendarRepository.getTodayEventsForCalendars([1, 2])

    // Assert
    expect(result).toEqual(fakeEvents)
  })
})

// ─── createEvent ──────────────────────────────────────────────────────────

describe('calendarRepository — createEvent', () => {
  it('retorna el evento creado', async () => {
    // Arrange
    const eventData = { title: 'Control 1', start_datetime: '2026-06-20T10:00:00', event_type: 'exam' }
    const created = { id: 10, calendar_id: 1, ...eventData }
    mockSupabase.from.mockReturnValue(mockChain({ data: created, error: null }))

    // Act
    const result = await calendarRepository.createEvent(1, eventData)

    // Assert
    expect(result).toEqual(created)
  })
})

// ─── createReminder ───────────────────────────────────────────────────────

describe('calendarRepository — createReminder', () => {
  it('retorna el recordatorio creado', async () => {
    // Arrange
    const created = { id: 3, student_id: 'u1', event_id: 10, reminder_at: '2026-06-19T09:00:00', sent: false }
    mockSupabase.from.mockReturnValue(mockChain({ data: created, error: null }))

    // Act
    const result = await calendarRepository.createReminder('u1', 10, '2026-06-19T09:00:00')

    // Assert
    expect(result).toEqual(created)
    expect(mockSupabase.from).toHaveBeenCalledWith('event_reminders')
  })
})
