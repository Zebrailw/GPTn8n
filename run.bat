@echo off
setlocal

if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
  )
)

if not exist .venv (
  echo Creating virtual environment...
  python -m venv .venv
)

call .venv\Scripts\activate

python -m pip install --upgrade pip
pip install -r apps\server\requirements.txt
if errorlevel 1 (
  echo Failed to install Python dependencies.
  exit /b 1
)

echo Starting server...
start "pab-server" cmd /k "cd /d apps\server && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo Open http://localhost:8000 in your browser.
start http://localhost:8000
endlocal
