@echo off
setlocal

if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
  )
)

echo Installing dependencies...
npm install
if errorlevel 1 (
  echo Failed to install dependencies.
  exit /b 1
)

echo Generating Prisma client...
npm run -w @pab/server prisma:generate
if errorlevel 1 exit /b 1

echo Running migrations...
npm run -w @pab/server prisma:migrate
if errorlevel 1 exit /b 1

echo Starting server and web...
start "pab-server" cmd /k "npm run dev:server"
start "pab-web" cmd /k "npm run dev:web"

echo Open http://localhost:5173 in your browser.
endlocal
