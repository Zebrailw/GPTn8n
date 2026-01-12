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

echo Installing frontend dependencies...
npm install
if errorlevel 1 (
  echo Failed to install frontend dependencies.
  exit /b 1
)

echo Running Alembic migrations...
cd /d apps\server
alembic upgrade head
if errorlevel 1 exit /b 1
cd /d ..\..

echo Starting server and web...
start "pab-server" cmd /k "cd /d apps\server && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
start "pab-web" cmd /k "npm run dev:web"

echo Open http://localhost:5173 in your browser.
endlocal
