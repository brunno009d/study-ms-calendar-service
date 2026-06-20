import express from 'express'
import cors from 'cors'
import calendarRoutes from './routes/calendarRoutes.js'
import errorHandler from './middleware/errorHandler.js'

const app = express();

// Middleware global
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'calendar-service',
        timestamp: new Date().toISOString()
    });
});

// Rutas
app.use('/', calendarRoutes);

// Ruta no encontrada
app.use((req, res) => {
    res.status(404).json({
        error: 'not_found',
        message: `Ruta ${req.method} ${req.path} no encontrada en ps-ms-calendar-service`
    });
});

// Manejo de errores global
app.use(errorHandler);

export default app
