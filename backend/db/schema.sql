CREATE TABLE IF NOT EXISTS specialidad (
 id SERIAL PRIMARY KEY,
 nombre VARCHAR(255) UNIQUE NOT NULL,
 descripcion TEXT DEFAULT '',
 atendido_por_bot BOOLEAN DEFAULT TRUE NOT NULL,
 edad_min INTEGER,
 edad_max INTEGER,
 genero VARCHAR(20),
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profesional (
 id SERIAL PRIMARY KEY,
 id_profesional INTEGER UNIQUE,
 nombre VARCHAR(255) NOT NULL,
 sexo VARCHAR(20),
 edad_min INTEGER,
 edad_max INTEGER,
 genero VARCHAR(20),
 prioridad INTEGER,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profesional_especialidad (
 profesional_id INTEGER NOT NULL,
 especialidad_id INTEGER NOT NULL,
 PRIMARY KEY (profesional_id, especialidad_id),
 FOREIGN KEY (profesional_id) REFERENCES profesional(id) ON DELETE CASCADE,
 FOREIGN KEY (especialidad_id) REFERENCES specialidad(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_profesional_especialidad_especialidad 
  ON profesional_especialidad(especialidad_id);

CREATE TABLE IF NOT EXISTS practica (
 id SERIAL PRIMARY KEY,
 nombre VARCHAR(255) NOT NULL,
 descripcion TEXT DEFAULT '',
 atendido_por_bot BOOLEAN DEFAULT TRUE NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS practica_especialidad (
 practica_id INTEGER NOT NULL,
 especialidad_id INTEGER NOT NULL,
 PRIMARY KEY (practica_id, especialidad_id),
 FOREIGN KEY (practica_id) REFERENCES practica(id) ON DELETE CASCADE,
 FOREIGN KEY (especialidad_id) REFERENCES specialidad(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_practica_especialidad_especialidad 
  ON practica_especialidad(especialidad_id);

CREATE TABLE IF NOT EXISTS schema_meta (
 id SERIAL PRIMARY KEY,
 schema_hash VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS texto_predefinido (
 id SERIAL PRIMARY KEY,
 nombre VARCHAR(255) NOT NULL,
 texto TEXT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinic_info (
 id SERIAL PRIMARY KEY,
 descripcion TEXT,
 direccion VARCHAR(255),
 ubicacion_url VARCHAR(255),
 pagina_web VARCHAR(255),
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS faqs (
 id SERIAL PRIMARY KEY,
 question VARCHAR(1024) NOT NULL,
 answer TEXT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
