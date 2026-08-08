@echo off
set PATH=C:\Program Files\nodejs;%PATH%
echo Starting VoiceX UI Server on http://localhost:5173 ...
npm.cmd run dev -- --host --port 5173
pause
