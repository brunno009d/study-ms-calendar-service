import express from 'express'
import calendarController from '../controller/calendarController.js'
import { getContext } from '../controller/aiContextController.js'
import requireAuth from '../middleware/requireAuth.js'

const router = express.Router()

// Aplicar middleware de autenticación a TODAS las rutas
router.use(requireAuth);

// IA: Calendarios + eventos próximos 30 días (solo lectura)
router.get('/ai-context', getContext);

// CALENDARIOS 

// Lista calendarios del estudiante
router.get('/', calendarController.getCalendars);

// Crea un nuevo calendario
router.post('/', calendarController.createCalendar);

// Elimina un calendario
router.delete('/:calendarId', calendarController.deleteCalendar);

// (Dashboard) 

// Eventos de hoy de todos los calendarios
router.get('/all-events/today', calendarController.getTodayEvents);

// EVENTOS 

// Lista eventos (con filtro de fechas)
router.get('/:calendarId/events', calendarController.getEventsByCalendar);

// Crea un evento en ese calendario
router.post('/:calendarId/events', calendarController.createEvent);

// EVENTOS INDIVIDUALES

// Actualiza un evento
router.put('/events/:eventId', calendarController.updateEvent);

// Elimina un evento
router.delete('/events/:eventId', calendarController.deleteEvent);

// Crea un recordatorio para un evento
router.post('/events/:eventId/reminders', calendarController.createReminder);

export default router
