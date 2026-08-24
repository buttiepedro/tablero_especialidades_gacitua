CREATE TABLE IF NOT EXISTS specialidad (
 id SERIAL PRIMARY KEY,
 nombre VARCHAR(255) UNIQUE NOT NULL,
 descripcion TEXT DEFAULT '',
 atendido_por_bot BOOLEAN DEFAULT TRUE NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS profesionales (
 id SERIAL PRIMARY KEY,
 nombre_completo VARCHAR(255) NOT NULL,
 nombre_especialidad VARCHAR(255) DEFAULT '',
 nombre_especialidad2 VARCHAR(255) DEFAULT '',
 nombre_especialidad3 VARCHAR(255) DEFAULT '',
 id_profesional INTEGER UNIQUE,
 notaweb TEXT DEFAULT '',
 notaweb_manual TEXT DEFAULT '',
 criterio_genero VARCHAR(32) DEFAULT '',
 criterio_edad_desde INTEGER,
 criterio_edad_hasta INTEGER,
 cargo VARCHAR(255) DEFAULT '',
 telefono VARCHAR(255) DEFAULT '',
 email VARCHAR(255) DEFAULT '',
 descripcion TEXT DEFAULT '',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
