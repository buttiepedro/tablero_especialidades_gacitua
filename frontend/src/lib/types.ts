export interface HorarioDia {
  abierto: boolean;
  inicio: string | null;
  cierre: string | null;
  divide_turno: boolean;
  tarde_inicio: string | null;
  tarde_cierre: string | null;
}

export interface Horarios {
  lunes: HorarioDia;
  martes: HorarioDia;
  miercoles: HorarioDia;
  jueves: HorarioDia;
  viernes: HorarioDia;
  sabado: HorarioDia;
  domingo: HorarioDia;
}

export interface ClinicInfo {
  descripcion: string;
  direccion: string;
  ubicacion_url: string;
  pagina_web: string;
  horarios: Horarios;
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
