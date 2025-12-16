Proyecto `bus_detector` — interfaz para mostrar posición del bus y detección de HMACs.

Run locally:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

uvicorn bus_detector.app.main:app --reload --port 8000

or 

python -m uvicorn bus_detector.app.main:app --reload --port 8000
```

Páginas:
- `/` — home
- `/trajectory` — vista con paradas y bus

El endpoint `/api/state` devuelve el estado actual leyendo `app/data/sample_data.json`. Puedes reemplazar ese archivo con el que te proporcionen tus compañeros o usar `POST /api/state` para subir JSON.
