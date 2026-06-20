import calendarService from '../service/calendarService.js'
import calendarRepository from '../repository/calendarRepository.js'

/**
 * GET /ai-context
 * Devuelve todos los calendarios del estudiante + eventos de los próximos 30 días.
 * SOLO LECTURA — usado por el ai-service para dar consejos personalizados.
 */
const getContext = async (req, res, next) => {
    try {
        // 1. Todos los calendarios del estudiante
        const calendars = await calendarService.getCalendars(req.userId);

        if (!calendars.length) {
            return res.status(200).json({ calendars: [], upcoming_events: [] });
        }

        // 2. Eventos de los próximos 30 días de TODOS los calendarios
        const calendarIds = calendars.map(c => c.id);
        const now = new Date();
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        let allEvents = [];
        for (const calId of calendarIds) {
            const events = await calendarRepository.getEventsByCalendarId(
                calId,
                now.toISOString(),
                in30Days.toISOString()
            );
            // Agregar nombre del calendario a cada evento para contexto
            const calTitle = calendars.find(c => c.id === calId)?.title || '';
            allEvents.push(...events.map(e => ({ ...e, calendar_title: calTitle })));
        }

        // Ordenar cronológicamente
        allEvents.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

        res.status(200).json({
            calendars,
            upcoming_events: allEvents
        });
    } catch (error) {
        next(error);
    }
};

export { getContext }
