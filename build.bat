@echo off
setlocal enabledelayedexpansion

echo ==^> Installing dependencies...
call npm ci
if %errorlevel% neq 0 (
    echo npm ci failed, attempting npm install...
    call npm install
    if %errorlevel% neq 0 (
        echo npm install failed.
        exit /b %errorlevel%
    )
)

echo ==^> Compiling TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo TypeScript build failed.
    exit /b %errorlevel%
)

echo ==^> Packaging standalone executable (Windows)...
call npx caxa --input . --output AnimalHospitalOrganizer.exe --exclude "tests" "data" "*.md" -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/dist/index.js"
if %errorlevel% neq 0 (
    echo caxa packaging failed.
    exit /b %errorlevel%
)

echo ==^> Build complete!
