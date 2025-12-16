from fastapi import FastAPI, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse
from pathlib import Path
import json

BASE_DIR = Path(__file__).parent

app = FastAPI()
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

SAMPLE_FILE = BASE_DIR / "data" / "sample_data.json"
SEQUENCE_FILE = BASE_DIR / "data" / "sequence.json"


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})


@app.get("/trajectory", response_class=HTMLResponse)
def trajectory(request: Request):
    return templates.TemplateResponse("trajectory.html", {"request": request})


@app.get("/api/state")
def api_state():
    try:
        data = json.loads(SAMPLE_FILE.read_text())
    except Exception:
        data = {"current_stop": 0, "stops": 10, "hashes": []}
    return JSONResponse(content=data)


@app.post("/api/state")
async def upload_state(file: UploadFile = File(...)):
    content = await file.read()
    try:
        obj = json.loads(content)
        SAMPLE_FILE.write_text(json.dumps(obj))
        return JSONResponse(content={"ok": True})
    except Exception as e:
        return JSONResponse(content={"ok": False, "error": str(e)}, status_code=400)


@app.get("/sequence", response_class=HTMLResponse)
def sequence_page(request: Request):
    return templates.TemplateResponse("sequence.html", {"request": request})


@app.get("/api/sequence")
def api_sequence():
    try:
        data = json.loads(SEQUENCE_FILE.read_text())
    except Exception:
        data = []
    return JSONResponse(content=data)
