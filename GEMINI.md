# Gemini Project Context: Measure Oh Sung

## Project Overview

This is a full-stack web application for "Measure Oh Sung". It features a Python FastAPI backend and a Next.js frontend. The application is designed to interface with measurement devices, manage inspection models, and log system data.

**Key Technologies:**

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts for charts.
*   **Backend:** Python, FastAPI, SQLAlchemy (with SQLite for development), Pydantic for data validation.
*   **Real-time Communication:** WebSockets are used for real-time updates between the frontend and backend.
*   **Device Communication:** `pyserial` is used for serial communication with measurement devices.

**Architecture:**

*   **`frontend/`**: A Next.js application that provides the user interface. It communicates with the backend via a REST API and WebSockets.
*   **`backend/`**: A FastAPI application that exposes a REST API for managing devices, inspections, and measurements. It also handles serial communication with hardware.
*   **`scripts/`**: Contains batch scripts for automating common tasks like setup and running the development servers.

## Building and Running

### Initial Setup

To set up the project for the first time, run the following command from the root directory:

```bash
setup_project.bat
```

This will install both the frontend and backend dependencies.

### Running the Development Servers

**1. Start the Frontend:**

```bash
start_frontend.bat
```

The frontend will be available at `http://localhost:3000`.

**2. Start the Backend:**

Open a new terminal and run:

```bash
start_backend.bat
```

The backend API will be available at `http://localhost:8000`. The API documentation (Swagger UI) can be accessed at `http://localhost:8000/docs`.

### Running Commands Manually

**Frontend (`frontend/` directory):**

*   `npm run dev`: Starts the Next.js development server.
*   `npm run build`: Builds the frontend for production.
*   `npm run lint`: Lints the frontend code.

**Backend (`backend/` directory):**

1.  Activate the Python virtual environment:
    ```bash
    activate_backend.bat
    ```
2.  Run the FastAPI server:
    ```bash
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
    ```

## Development Conventions

*   **Code Style:** The project uses ESLint for the frontend to enforce a consistent code style.
*   **API:** The backend API is documented using OpenAPI (Swagger) and can be found at `/docs` when the backend server is running.
*   **Database:** The project uses SQLAlchemy as the ORM. Database migrations are handled by Alembic.
*   **Environment Variables:** The backend uses a `.env` file for configuration. A `config.py` file loads these settings.
*   **Real-time Updates:** The frontend uses a `useWebSocket` hook to connect to the backend's WebSocket for real-time data.
*   **UI Components:** The frontend uses `shadcn/ui` for pre-built UI components.
