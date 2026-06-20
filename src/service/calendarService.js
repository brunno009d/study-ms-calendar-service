import calendarRepository from '../repository/calendarRepository.js'

class CalendarService {

    // CALENDARIOS 

    // obtiene los calendarios del estudiante
    async getCalendars(studentId) {
        return await calendarRepository.getCalendarsByStudentId(studentId);
    }

    // crea un nuevo calendario
    async createCalendar(studentId, { title }) {
        if (!title || !title.trim()) {
            const error = new Error('El título del calendario es obligatorio');
            error.name = 'ValidationError';
            throw error;
        }

        return await calendarRepository.createCalendar(studentId, title.trim());
    }

    // elimina un calendario
    async deleteCalendar(calendarId, studentId) {
        await this._verifyCalendarOwnership(calendarId, studentId);
        return await calendarRepository.deleteCalendar(calendarId);
    }

    // EVENTOS

    // obtiene eventos por calendario validando propiedad
    async getEventsByCalendar(calendarId, studentId, startDate, endDate) {
        await this._verifyCalendarOwnership(calendarId, studentId);
        return await calendarRepository.getEventsByCalendarId(calendarId, startDate, endDate);
    }

    // obtiene eventos de hoy para el dashboard
    async getTodayEvents(studentId) {
        const calendars = await calendarRepository.getCalendarsByStudentId(studentId);
        if (!calendars.length) return [];

        const calendarIds = calendars.map((c) => c.id);
        return await calendarRepository.getTodayEventsForCalendars(calendarIds);
    }

    // crea un evento
    async createEvent(calendarId, eventData, studentId) {
        await this._verifyCalendarOwnership(calendarId, studentId);

        if (!eventData.title || !eventData.title.trim()) {
            const error = new Error('El título del evento es obligatorio');
            error.name = 'ValidationError';
            throw error;
        }
        if (!eventData.start_datetime) {
            const error = new Error('La fecha de inicio (start_datetime) es obligatoria');
            error.name = 'ValidationError';
            throw error;
        }

        const newEvent = await calendarRepository.createEvent(calendarId, {
            title: eventData.title.trim(),
            description: eventData.description,
            start_datetime: eventData.start_datetime,
            end_datetime: eventData.end_datetime,
            event_type: eventData.event_type,
            color_hex: eventData.color_hex,
            evaluation_id: eventData.evaluation_id
        });

        let reminder = null;
        if (eventData.reminder_at) {
            reminder = await calendarRepository.createReminder(
                studentId,
                newEvent.id,
                eventData.reminder_at
            );
        }

        return { event: newEvent, reminder };
    }

    // actualiza un evento
    async updateEvent(eventId, updateData, studentId) {
        await this._verifyEventOwnership(eventId, studentId);

        const allowedFields = [
            'title', 'description', 'start_datetime', 'end_datetime',
            'event_type', 'color_hex', 'evaluation_id'
        ];
        const sanitized = {};
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                sanitized[field] = updateData[field];
            }
        }

        if (Object.keys(sanitized).length === 0) {
            const error = new Error('No se enviaron campos válidos para actualizar');
            error.name = 'ValidationError';
            throw error;
        }

        return await calendarRepository.updateEvent(eventId, sanitized);
    }

    // elimina un evento
    async deleteEvent(eventId, studentId) {
        await this._verifyEventOwnership(eventId, studentId);
        return await calendarRepository.deleteEvent(eventId);
    }

    // --- RECORDATORIOS ---

    // crea un recordatorio para un evento
    async createReminder(eventId, studentId, reminderAt) {
        await this._verifyEventOwnership(eventId, studentId);

        if (!reminderAt) {
            const error = new Error('La fecha del recordatorio (reminder_at) es obligatoria');
            error.name = 'ValidationError';
            throw error;
        }

        return await calendarRepository.createReminder(studentId, eventId, reminderAt);
    }

    // --- MÉTODOS PRIVADOS ---

    // verifica propiedad del calendario
    async _verifyCalendarOwnership(calendarId, studentId) {
        const calendar = await calendarRepository.getCalendarById(calendarId);

        if (!calendar) {
            const error = new Error('Calendario no encontrado');
            error.status = 404;
            throw error;
        }

        if (calendar.student_id !== studentId) {
            const error = new Error('No tienes permisos sobre este calendario');
            error.status = 403;
            throw error;
        }

        return calendar;
    }

    // verifica propiedad del evento
    async _verifyEventOwnership(eventId, studentId) {
        const event = await calendarRepository.getEventById(eventId);

        if (!event) {
            const error = new Error('Evento no encontrado');
            error.status = 404;
            throw error;
        }

        if (event.calendar?.student_id !== studentId) {
            const error = new Error('No tienes permisos sobre este evento');
            error.status = 403;
            throw error;
        }

        return event;
    }
}

export default new CalendarService()
