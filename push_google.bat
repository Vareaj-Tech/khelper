@echo off
cd /d "%~dp0"
echo Cleaning stale git locks...
del /f /q .git\index.lock 2>nul
del /f /q .git\HEAD.lock 2>nul
echo Staging files...
git add index.html netlify.toml
echo Committing...
git commit -m "Add Google OAuth + user count tracking"
echo Pushing to GitHub...
git push origin main
echo.
if %ERRORLEVEL% EQU 0 (
  echo SUCCESS: Changes pushed.
) else (
  echo ERROR: Push failed. Check credentials or run: git push origin main
)
pause
