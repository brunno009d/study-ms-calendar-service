const errorHandler = (err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

    // Error de validación
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'validation_error',
            message: err.message
        });
    }

    // Error de formato UUID o tipos de datos en Postgres
    if (err.code === '22P02') {
        return res.status(400).json({
            error: 'bad_request',
            message: 'El formato de ID proporcionado no es válido'
        });
    }

    // Error de clave foránea o restricciones
    if (err.code === '23503') {
        return res.status(400).json({
            error: 'bad_request',
            message: 'Referencia a un recurso inexistente'
        });
    }

    // Error genérico o error con status predefinido
    const status = err.status || 500;
    const message = status === 500 ? 'Error interno del servidor' : err.message;

    res.status(status).json({
        error: status === 500 ? 'internal_error' : 'request_error',
        message: message
    });
};

module.exports = errorHandler;
