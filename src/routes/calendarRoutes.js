const express = require('express');
const router = express.Router();
const calendarController = require('../controller/calendarController');
const requireAuth = require('../middleware/requireAuth');

// Aplicar middleware de autenticación a TODAS las rutas
router.use(requireAuth);

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

module.exports = router;
