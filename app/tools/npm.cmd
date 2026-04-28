@echo off
setlocal

set "APP_ROOT=%~dp0.."
for %%I in ("%APP_ROOT%") do set "APP_ROOT=%%~fI"
for %%I in ("%APP_ROOT%\..") do set "WORKSPACE_ROOT=%%~fI"

set "NODE_DIR="
for /f "delims=" %%D in ('dir /b /ad /o-n "%WORKSPACE_ROOT%\.tools\node-v*-win-x64" 2^>nul') do (
  if not defined NODE_DIR set "NODE_DIR=%WORKSPACE_ROOT%\.tools\%%D"
)

if not defined NODE_DIR (
  echo Portable Node was not found under %WORKSPACE_ROOT%\.tools. 1>&2
  exit /b 1
)

if not exist "%NODE_DIR%\npm.cmd" (
  echo npm.cmd was not found at %NODE_DIR%\npm.cmd. 1>&2
  exit /b 1
)

set "PATH=%NODE_DIR%;%PATH%"
set "ELECTRON_RUN_AS_NODE="
call "%NODE_DIR%\npm.cmd" %*
exit /b %ERRORLEVEL%
