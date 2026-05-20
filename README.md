# PopStudy - Calendar Microservice (`ps-ms-calendar-service`)

Este microservicio forma parte del ecosistema de **PopStudy** y se encarga de la gestión de calendarios, eventos y recordatorios para los estudiantes. Está construido con **Node.js**, **Express** y se integra directamente con **Supabase** para la persistencia de datos y la verificación de la autenticación.

---

## 🛠️ Tecnologías Utilizadas

- **Runtime:** Node.js (v20+)
- **Framework Web:** Express.js (v5)
- **Base de Datos:** PostgreSQL (alojado en Supabase)
- **SDK:** `@supabase/supabase-js` (v2)
- **Autenticación:** Supabase Auth (JWT via Bearer Tokens)
- **Herramientas de Desarrollo:** Nodemon, Dotenv, Cors

---

## 📁 Estructura del Proyecto

El microservicio sigue un diseño limpio estructurado en capas:

```text
ps-ms-calendar-service/
├── src/
│   ├── config/          # Configuración de clientes (Supabase)
│   ├── controller/      # Controladores que manejan las peticiones HTTP
│   ├── middleware/      # Middlewares (autenticación, manejo de errores)
│   ├── repository/      # Capa de acceso a datos (queries a Supabase)
│   ├── routes/          # Definición de rutas del API
│   ├── service/         # Lógica de negocio
│   └── app.js           # Configuración general del Express App
├── index.js             # Punto de entrada del servidor
├── Dockerfile           # Configuración de Docker para producción
├── .env.example         # Plantilla de variables de entorno
└── package.json         # Dependencias y scripts del proyecto
```

---

## ⚙️ Configuración del Entorno

Para ejecutar el servicio localmente, crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```env
# --- CONFIGURACIÓN GENERAL ---
PORT=3004
NODE_ENV=development

# --- SUPABASE (Secrets) ---
SUPABASE_URL=tu_supabase_url
SUPABASE_SERVICE_ROLE=tu_supabase_service_role
```

### Explicación de Variables:
- **`PORT`**: Puerto local donde se levantará el servidor (por defecto `3004`).
- **`SUPABASE_URL`**: URL del proyecto de tu base de datos Supabase.
- **`SUPABASE_SERVICE_ROLE`**: Clave Service Role (Service Key) para interactuar de forma segura con la base de datos saltándose políticas RLS cuando corresponda.

---

## 🚀 Instrucciones de Ejecución

### Ejecución Local

1. Instalar las dependencias:
   ```bash
   npm install
   ```

2. Correr en modo desarrollo (con recarga automática mediante Nodemon):
   ```bash
   npm run dev
   ```

3. Correr en modo producción:
   ```bash
   npm start
   ```

### Ejecución con Docker

Puedes compilar y ejecutar el contenedor usando el `Dockerfile` provisto:

1. Construir la imagen de Docker:
   ```bash
   docker build -t ps-ms-calendar-service .
   ```

2. Ejecutar el contenedor:
   ```bash
   docker run -p 3004:3004 --env-file .env ps-ms-calendar-service
   ```

---

## 🔐 Autenticación

Todas las rutas del microservicio (excepto `GET /health`) requieren autenticación obligatoria.
El microservicio utiliza el middleware `requireAuth` que valida el token JWT emitido por Supabase Auth.

Debes pasar el token en las cabeceras HTTP de cada petición utilizando el formato:
```http
Authorization: Bearer <TU_TOKEN_JWT_DE_SUPABASE>
```

El middleware decodifica el token, obtiene el `userId` y lo inyecta en el objeto request (`req.userId`) para que esté disponible en los controladores.

---

## 📡 Referencia de la API (Endpoints)

### General

#### `GET /health`
* **Descripción:** Comprueba el estado y disponibilidad del microservicio.
* **Autenticación requerida:** No
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "status": "ok",
    "service": "calendar-service",
    "timestamp": "2026-05-20T16:48:56.000Z"
  }
  ```

---

### Contexto de Inteligencia Artificial

#### `GET /ai-context`
* **Descripción:** Devuelve todos los calendarios del estudiante junto con los eventos de los próximos 30 días ordenados cronológicamente. Utilizado principalmente por el microservicio de IA para proveer consejos de estudio personalizados.
* **Autenticación requerida:** Sí
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "calendars": [
      { "id": 1, "student_id": "usr_123", "title": "Estudios Académicos" }
    ],
    "upcoming_events": [
      {
        "id": "evt_abc",
        "calendar_id": 1,
        "title": "Examen Final de Física",
        "description": "Temas 1 al 5",
        "start_datetime": "2026-05-25T14:00:00.000Z",
        "end_datetime": "2026-05-25T16:00:00.000Z",
        "event_type": "exam",
        "color_hex": "#FF5733",
        "evaluation_id": null,
        "calendar_title": "Estudios Académicos"
      }
    ]
  }
  ```

---

### Calendarios

#### `GET /`
* **Descripción:** Obtiene una lista de todos los calendarios pertenecientes al estudiante autenticado.
* **Autenticación requerida:** Sí
* **Respuesta Exitosa (200 OK):**
  ```json
  [
    {
      "id": 1,
      "student_id": "usr_123",
      "title": "Estudios Académicos"
    }
  ]
  ```

#### `POST /`
* **Descripción:** Crea un nuevo calendario para el estudiante.
* **Autenticación requerida:** Sí
* **Cuerpo de la Petición (JSON):**
  ```json
  {
    "title": "Mi Nuevo Calendario"
  }
  ```
* **Respuesta Exitosa (201 Created):**
  ```json
  {
    "id": 2,
    "student_id": "usr_123",
    "title": "Mi Nuevo Calendario"
  }
  ```

#### `DELETE /:calendarId`
* **Descripción:** Elimina un calendario del estudiante por su ID (cascada automática para sus eventos asociados en base de datos).
* **Autenticación requerida:** Sí
* **Respuesta Exitosa (204 No Content):** (Sin cuerpo)

---

### Dashboard

#### `GET /all-events/today`
* **Descripción:** Obtiene todos los eventos programados para el día de hoy correspondientes a todos los calendarios del estudiante.
* **Autenticación requerida:** Sí
* **Respuesta Exitosa (200 OK):**
  ```json
  [
    {
      "id": "evt_xyz",
      "calendar_id": 1,
      "title": "Repaso de Matemáticas",
      "start_datetime": "2026-05-20T18:00:00.000Z",
      "end_datetime": "2026-05-20T20:00:00.000Z"
    }
  ]
  ```

---

### Eventos de Calendario

#### `GET /:calendarId/events`
* **Descripción:** Obtiene los eventos de un calendario específico, permitiendo un filtro opcional por rango de fechas.
* **Autenticación requerida:** Sí
* **Parámetros de consulta (Query Params - Opcionales):**
  - `startDate`: Fecha de inicio en formato ISO string (ej. `2026-05-01T00:00:00.000Z`).
  - `endDate`: Fecha de término en formato ISO string (ej. `2026-05-31T23:59:59.000Z`).
* **Respuesta Exitosa (200 OK):**
  ```json
  [
    {
      "id": "evt_xyz",
      "calendar_id": 1,
      "title": "Entregar Tarea",
      "description": "Subir el PDF al portal",
      "start_datetime": "2026-05-21T23:59:00.000Z",
      "end_datetime": null,
      "event_type": "task",
      "color_hex": "#33FF57",
      "evaluation_id": null
    }
  ]
  ```

#### `POST /:calendarId/events`
* **Descripción:** Crea un evento dentro de un calendario específico.
* **Autenticación requerida:** Sí
* **Cuerpo de la Petición (JSON):**
  * Campos obligatorios: `title`, `start_datetime`.
  * Campos opcionales: `description`, `end_datetime`, `event_type`, `color_hex`, `evaluation_id`.
  ```json
  {
    "title": "Estudio de Programación",
    "description": "Resolver ejercicios de arreglos",
    "start_datetime": "2026-05-22T15:00:00.000Z",
    "end_datetime": "2026-05-22T17:00:00.000Z",
    "event_type": "study_session",
    "color_hex": "#3357FF"
  }
  ```
* **Respuesta Exitosa (201 Created):**
  ```json
  {
    "id": "evt_new",
    "calendar_id": 1,
    "title": "Estudio de Programación",
    "description": "Resolver ejercicios de arreglos",
    "start_datetime": "2026-05-22T15:00:00.000Z",
    "end_datetime": "2026-05-22T17:00:00.000Z",
    "event_type": "study_session",
    "color_hex": "#3357FF",
    "evaluation_id": null
  }
  ```

#### `PUT /events/:eventId`
* **Descripción:** Actualiza uno o más campos de un evento específico.
* **Autenticación requerida:** Sí
* **Cuerpo de la Petición (JSON):**
  ```json
  {
    "title": "Estudio de Programación (Modificado)",
    "color_hex": "#9933FF"
  }
  ```
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "id": "evt_new",
    "calendar_id": 1,
    "title": "Estudio de Programación (Modificado)",
    "description": "Resolver ejercicios de arreglos",
    "start_datetime": "2026-05-22T15:00:00.000Z",
    "end_datetime": "2026-05-22T17:00:00.000Z",
    "event_type": "study_session",
    "color_hex": "#9933FF",
    "evaluation_id": null
  }
  ```

#### `DELETE /events/:eventId`
* **Descripción:** Elimina permanentemente un evento.
* **Autenticación requerida:** Sí
* **Respuesta Exitosa (204 No Content):** (Sin cuerpo)

---

### Recordatorios

#### `POST /events/:eventId/reminders`
* **Descripción:** Crea un recordatorio para un evento específico.
* **Autenticación requerida:** Sí
* **Cuerpo de la Petición (JSON):**
  - `reminder_at`: Fecha y hora programada para el recordatorio (formato ISO string).
  ```json
  {
    "reminder_at": "2026-05-22T14:45:00.000Z"
  }
  ```
* **Respuesta Exitosa (201 Created):**
  ```json
  {
    "id": 10,
    "student_id": "usr_123",
    "event_id": "evt_new",
    "reminder_at": "2026-05-22T14:45:00.000Z",
    "sent": false
  }
  ```
