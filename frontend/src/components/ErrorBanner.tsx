import type { ApiErrorType } from "@/lib/types";

const MESSAGES: Record<ApiErrorType, string> = {
  no_backend: "No se pudo conectar con el servidor.",
  db_unavailable: "Base de datos no disponible. Intenta de nuevo en unos instantes.",
  server_error: "Error interno del servidor.",
  unauthorized: "Sesión expirada.",
};

export default function ErrorBanner({ errorType }: { errorType: ApiErrorType }) {
  return (
    <div className="status-msg status-error" role="alert">
      {MESSAGES[errorType]}
    </div>
  );
}
