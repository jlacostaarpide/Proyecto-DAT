# Bus Detector

Proyecto académico de Juan Lacosta que simula y visualiza la detección anónima de pasajeros a bordo de un autobús mediante identificadores tipo HMAC, mostrando en tiempo (cuasi) real la posición del bus y las personas detectadas en cada parada.

## Arquitectura y stack tecnológico

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python), servido con `uvicorn`.
- **Plantillas**: Jinja2 (`app/templates/`), renderizadas en el servidor.
- **Frontend**: HTML + JavaScript vanilla (sin frameworks), con SVG para dibujar el recorrido del bus y las paradas (`app/static/app.js`, `app/static/sequence.js`).
- **Persistencia**: no hay base de datos; el estado se lee/escribe directamente sobre ficheros JSON en `app/data/` (`sample_data.json`, `sequence.json`).
- **Simulación de datos**: script Python independiente (`scripts/simulate_bus.py`) que genera datos ficticios de pasajeros y los escribe periódicamente en `sample_data.json`, emulando lo que enviaría un dispositivo embarcado (Arduino/sensor) en el bus.

Dependencias (`requirements.txt`): `fastapi[standard]`, `uvicorn`, `jinja2`.

## Estructura del proyecto

```
app/
  main.py              # aplicación FastAPI y endpoints
  data/
    sample_data.json   # estado actual del bus (leído/escrito por la API)
    sequence.json       # secuencia de snapshots de ejemplo para reproducir un trayecto
  static/
    app.js              # lógica de polling y render de la vista "Trajectory"
    sequence.js          # reproductor de secuencias en la vista "Sequence"
    styles.css
  templates/
    base.html
    home.html
    trajectory.html
    sequence.html
scripts/
  simulate_bus.py       # simulador de datos de bus/Arduino
  simulate_bus.sh        # wrapper en bash para lanzar el simulador
requirements.txt
```

## Endpoints disponibles

| Método | Ruta            | Descripción                                                                                               |
|--------|-----------------|-------------------------------------------------------------------------------------------------------------|
| GET    | `/`             | Página de inicio (home) con una breve descripción del proyecto.                                             |
| GET    | `/trajectory`   | Vista principal: dibuja la línea de paradas y el bus, y hace *polling* a `/api/state` cada segundo (configurable) para mover el bus y mostrar los pasajeros detectados como puntos dentro de un popup. |
| GET    | `/api/state`    | Devuelve el JSON actual de `app/data/sample_data.json` (`current_stop`, `stops`, `hashes`, `last_update`). Si el fichero no existe o no es válido, devuelve un estado por defecto (`{"current_stop": 0, "stops": 10, "hashes": []}`). |
| POST   | `/api/state`    | Recibe un fichero JSON (`multipart/form-data`) y sobrescribe `sample_data.json` con su contenido. Sin ninguna validación de esquema ni autenticación. |
| GET    | `/sequence`     | Vista con un reproductor de secuencias: permite cargar un JSON con varios snapshots y reproducir el movimiento del bus parada a parada. |
| GET    | `/api/sequence` | Devuelve el contenido de `app/data/sequence.json` (lista de snapshots). *Nota:* la vista `/sequence` no consume este endpoint automáticamente; el usuario debe subir el fichero manualmente desde el navegador. |

## Instalación y ejecución

### Requisitos

- Python 3.11+ (probado con este intérprete; otras versiones 3.9+ deberían funcionar).

### Pasos

```powershell
# 1. Crear y activar un entorno virtual
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Instalar dependencias
pip install -r requirements.txt

# 3. Lanzar el servidor
uvicorn app.main:app --reload --port 8000
```

La aplicación quedará disponible en `http://localhost:8000`.

### Simular datos del bus

Para alimentar la interfaz con datos ficticios que cambien con el tiempo (en lugar de editar `sample_data.json` a mano):

```powershell
python scripts/simulate_bus.py --output app/data/sample_data.json --stops 10 --max-passengers 20 --interval 5
```

En Linux/macOS también existe un wrapper:

```bash
./scripts/simulate_bus.sh 5   # 5 = segundos entre actualizaciones
```

El script avanza `current_stop` en cada intervalo (con vuelta a 0 al llegar a la última parada) y añade/quita pasajeros aleatoriamente, reutilizando algunos identificadores para simular gente que ya había sido detectada antes.

### Cargar tus propios datos

- **Estado puntual**: reemplaza `app/data/sample_data.json` a mano, o envía un `POST` a `/api/state` con el fichero JSON.
- **Secuencia completa**: en la vista `/sequence`, usa el selector de fichero para cargar un JSON con el mismo formato que `app/data/sequence.json` (una lista de snapshots `{current_stop, stops, hashes, timestamp}`).

## Cómo funciona

- **"HMACs" de pasajeros**: cada persona detectada a bordo se representa como una cadena corta (`h_xxxxxxxx`) en el campo `hashes` del JSON de estado. El backend no genera ni verifica estos valores; simplemente los recibe y los reenvía tal cual. En este proyecto simulan el resultado de un proceso de anonimización (p. ej. un hash de una dirección MAC/BLE) que en un sistema real correría en el dispositivo embarcado o en una capa previa, no en `main.py`.
- **Tracking del bus**: la posición horizontal del bus en el SVG se calcula en el cliente como una interpolación lineal simple entre paradas: `x = 50 + (current_stop / (stops - 1)) * 900`. No hay GPS ni coordenadas geográficas reales, solo el índice de parada actual sobre un número fijo de paradas.
- **Actualización en vivo**: `app.js` hace *polling* HTTP a `/api/state` a intervalos configurables (por defecto 1 s) en lugar de usar WebSockets o Server-Sent Events.
- **Visualización de pasajeros**: al pulsar sobre el bus se abre un popup con un punto rojo por cada hash presente en `hashes`. La posición de cada punto dentro del bus se calcula de forma determinista a partir de un hash simple del identificador (`hashIndex`), de modo que un mismo pasajero mantiene su posición relativa mientras esté a bordo.
- **Reproducción de secuencias**: la vista `/sequence` no usa polling; carga una lista completa de snapshots (desde un fichero subido por el usuario) y permite reproducirlos como una animación, con controles de play/pausa/velocidad y una vista agregada (opcional, desactivada por defecto en la carga) de en qué paradas se vio cada hash.

## Limitaciones conocidas

- **Sin autenticación**: `POST /api/state` acepta y sobrescribe el estado sin ningún control de acceso.
- **Sin validación de esquema**: tanto `POST /api/state` como la carga de ficheros en `/sequence` solo comprueban que el contenido sea JSON válido, no que tenga la forma esperada (`current_stop`, `stops`, `hashes`, ...).
- **Persistencia mínima**: el estado vive en ficheros planos (`sample_data.json`, `sequence.json`), sin base de datos ni control de concurrencia más allá de la escritura atómica que hace el simulador (`scripts/simulate_bus.py`).
- **`stops` por defecto hardcodeado a 10** en el fallback de `/api/state` y en el número de círculos de parada dibujados en las plantillas (`{% for i in range(10) %}`), independientemente del valor real de `stops` en los datos.
- **`/api/sequence` no se usa desde el frontend**: existe el endpoint, pero la vista `/sequence` solo carga secuencias mediante subida manual de fichero, no haciendo `fetch` a ese endpoint.
- **Posiciones de pasajeros no persistentes entre recargas**: la disposición de los puntos dentro del popup del bus se calcula en memoria del navegador (`positionsByStop`) y se pierde al recargar la página.
- **"HMAC" es una simplificación**: los identificadores no son HMACs criptográficos reales generados/verificados por este proyecto, sino cadenas de ejemplo (`h_` + hexadecimal aleatorio) producidas por el simulador.
- **Entorno virtual versionado**: el repositorio no tiene un `.gitignore` efectivo (está vacío) y actualmente incluye el contenido de `.venv/` en el control de versiones.

