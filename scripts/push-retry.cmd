@echo off
rem Double-click wrapper: keep retrying the push until it succeeds.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push-retry.ps1" %*
pause
