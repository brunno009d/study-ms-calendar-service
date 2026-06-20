import calendarService from '../service/calendarService.js'

class CalendarController {

    // CALENDARIOS 

    // Obtiene todos los calendarios del estudiante
    async getCalendars(req, res, next) {
        try {
            const calendars = await calendarService.getCalendars(req.userId);
            res.status(200).json(calendars);
        } catch (error) {
            next(error);
        }
    }

    // Crea un nuevo calendario
    async createCalendar(req, res, next) {
        try {
            const { title } = req.body;
            const calendar = await calendarService.createCalendar(req.userId, { title });
            res.status(201).json(calendar);
        } catch (error) {
            next(error);
        }
    }

    // Elimina un calendario
    async deleteCalendar(req, res, next) {
        try {
            const { calendarId } = req.params;
            await calendarService.deleteCalendar(parseInt(calendarId), req.userId);
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    //  DASHBOARD 

    // Obtiene todos los eventos de todos los calendarios para el día de hoy.
    async getTodayEvents(req, res, next) {
        try {
            const events = await calendarService.getTodayEvents(req.userId);
            res.status(200).json(events);
        } catch (error) {
            next(error);
        }
    }

    // EVENTOS

    // Obtiene eventos de un calendario específico con filtros opcionales.
    async getEventsByCalendar(req, res, next) {
        try {
            const { calendarId } = req.params;
            const { startDate, endDate } = req.query;

            const events = await calendarService.getEventsByCalendar(
                parseInt(calendarId),
                req.userId,
                startDate,
                endDate
            );

            res.status(200).json(events);
        } catch (error) {
            next(error);
        }
    }

    // Crea un nuevo evento en un calendario
    async createEvent(req, res, next) {
        try {
            const { calendarId } = req.params;
            const eventData = req.body;

            // Validar campos requeridos
            if (!eventData.title || !eventData.start_datetime) {
                return res.status(400).json({ message: 'Campos requeridos faltantes: title y start_datetime' });
            }

            const result = await calendarService.createEvent(
                parseInt(calendarId),
                eventData,
                req.userId
            );

            res.status(201).json(result);
        } catch (error) {
            next(error);
        }
    }

    // Actualiza un evento existente.
    async updateEvent(req, res, next) {
        try {
            const { eventId } = req.params;
            const updateData = req.body;

            if (!updateData || Object.keys(updateData).length === 0) {
                return res.status(400).json({ message: 'Se debe proporcionar al menos un campo para actualizar' });
            }

            const updated = await calendarService.updateEvent(eventId, updateData, req.userId);
            res.status(200).json(updated);
        } catch (error) {
            next(error);
        }
    }

    // Elimina un evento del calendario.
    async deleteEvent(req, res, next) {
        try {
            const { eventId } = req.params;
            await calendarService.deleteEvent(eventId, req.userId);

            res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    // Crea un recordatorio para un evento específico.
    async createReminder(req, res, next) {
        try {
            const { eventId } = req.params;
            const { reminder_at } = req.body;

            const reminder = await calendarService.createReminder(eventId, req.userId, reminder_at);
            res.status(201).json(reminder);
        } catch (error) {
            next(error);
        }
    }
}

export default new CalendarController()

