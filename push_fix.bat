@echo off
echo Fixing K'Helper Khmer text encoding...
echo.

cd /d "C:\Users\Sokha\OneDrive\Documents\GitHub\khelper"

echo Removing git lock file if it exists...
if exist ".git\index.lock" (
    del ".git\index.lock"
    echo Lock file removed.
) else (
    echo No lock file found.
)

echo.
echo Staging index.html...
git add index.html

echo.
echo Committing fix...
git commit -m "Fix Khmer UTF-8 encoding - correct text display on site"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo Done! Check khelper.netlify.app in a minute.
pause
