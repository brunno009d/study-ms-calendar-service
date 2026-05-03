const supabase = require('../config/supabase');

class CalendarRepository {

    // Calendario 

    // obtiene todos los calendarios de un estudiante
    async getCalendarsByStudentId(studentId) {
        const { data, error } = await supabase
            .from('calendar')
            .select('*')
            .eq('student_id', studentId)
            .order('id', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    // obtiene un calendario por su id
    async getCalendarById(calendarId) {
        const { data, error } = await supabase
            .from('calendar')
            .select('*')
            .eq('id', calendarId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    // crea un calendario
    async createCalendar(studentId, title) {
        const { data, error } = await supabase
            .from('calendar')
            .insert({ student_id: studentId, title })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // elimina un calendario
    async deleteCalendar(calendarId) {
        const { error } = await supabase
            .from('calendar')
            .delete()
            .eq('id', calendarId);

        if (error) throw error;
        return true;
    }

    //  EVENTOS (calendar_event) 

    // obtiene eventos por calendario con filtros de fecha opcionales
    async getEventsByCalendarId(calendarId, startDate, endDate) {
        let query = supabase
            .from('calendar_event')
            .select('*')
            .eq('calendar_id', calendarId)
            .order('start_datetime', { ascending: true });

        if (startDate) query = query.gte('start_datetime', startDate);
        if (endDate) query = query.lte('start_datetime', endDate);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    // obtiene eventos de hoy para una lista de calendarios
    async getTodayEventsForCalendars(calendarIds) {
        if (!calendarIds || calendarIds.length === 0) return [];

        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

        const { data, error } = await supabase
            .from('calendar_event')
            .select('*')
            .in('calendar_id', calendarIds)
            .gte('start_datetime', startOfDay)
            .lte('start_datetime', endOfDay)
            .order('start_datetime', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    // obtiene un evento por su id
    async getEventById(eventId) {
        const { data, error } = await supabase
            .from('calendar_event')
            .select('*, calendar!inner(student_id)')
            .eq('id', eventId)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    // crea un evento
    async createEvent(calendarId, eventData) {
        const { data, error } = await supabase
            .from('calendar_event')
            .insert({
                calendar_id: calendarId,
                title: eventData.title,
                description: eventData.description || null,
                start_datetime: eventData.start_datetime,
                end_datetime: eventData.end_datetime || null,
                event_type: eventData.event_type || null,
                color_hex: eventData.color_hex || null,
                evaluation_id: eventData.evaluation_id || null
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // actualiza un evento
    async updateEvent(eventId, updateData) {
        const { data, error } = await supabase
            .from('calendar_event')
            .update(updateData)
            .eq('id', eventId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    // elimina un evento
    async deleteEvent(eventId) {
        const { error } = await supabase
            .from('calendar_event')
            .delete()
            .eq('id', eventId);

        if (error) throw error;
        return true;
    }

    // RECORDATORIOS (event_reminders) 

    // crea un recordatorio para un evento
    async createReminder(studentId, eventId, reminderAt) {
        const { data, error } = await supabase
            .from('event_reminders')
            .insert({
                student_id: studentId,
                event_id: eventId,
                reminder_at: reminderAt,
                sent: false
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

module.exports = new CalendarRepository();
