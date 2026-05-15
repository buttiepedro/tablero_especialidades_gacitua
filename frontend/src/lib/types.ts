export interface ClinicInfo {
  descripcion: string;
  direccion: string;
  ubicacion_url: string;
  pagina_web: string;
  updated_at?: string | null;
}

export interface Especialidad {
  id: string;
  especialidad: string;
  descripcion: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  created_at: string;
}

export interface MeResponse {
  username: string;
  created_at: string;
}

export type ApiErrorType = "no_backend" | "db_unavailable" | "server_error" | "unauthorized";

export type SafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; errorType: ApiErrorType };
