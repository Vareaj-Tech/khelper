@echo off
echo Clearing stale git locks...
del /f /q "%~dp0.git\HEAD.lock" 2>nul
del /f /q "%~dp0.git\index.lock" 2>nul
echo.
echo Committing auth changes...
cd /d "%~dp0"
git add index.html netlify.toml
git commit -m "Add Netlify Identity email/password auth"
echo.
echo Pushing to origin/main...
git push origin main
echo.
echo Done! Check output above.
pause
