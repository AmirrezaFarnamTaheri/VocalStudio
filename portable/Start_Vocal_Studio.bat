@echo off
cd /d "%~dp0"
py -3 VocalStudio.pyz %*
if errorlevel 1 python VocalStudio.pyz %*
