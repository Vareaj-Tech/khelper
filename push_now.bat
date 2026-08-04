@echo off
echo Pushing to GitHub...
cd /d "%~dp0"
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
git push origin main
echo.
echo Done! Netlify will auto-deploy in ~30 seconds.
pause
