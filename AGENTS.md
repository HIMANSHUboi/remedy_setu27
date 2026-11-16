# Project architecture

- Use TanStack Start server functions for authenticated database access and AI inference, keeping private operations in handler boundaries because the app runs on a serverless runtime.
- Keep team lead records owner-scoped by authenticated user identity in the database, while making the seeded product catalogue readable to signed-in agents.
