@echo off
set REPO=C:\Users\Sokha\OneDrive\Documents\GitHub\khelper\khelper

echo === Cleaning any git locks ===
del /F "%REPO%\.git\index.lock" 2>nul
del /F "%REPO%\.git\objects\maintenance.lock" 2>nul

echo === Staging index.html ===
git -C "%REPO%" add index.html
del /F "%REPO%\.git\index.lock" 2>nul

echo === Committing ===
git -C "%REPO%" commit -m "feat: no-login splash — language pill enters app directly

- Remove Netlify Identity requirement (no account needed)
- Third badge changed: Trusted -> No sign-up
- Language pill (km/kr/en) now calls enterApp() directly
- enterApp() loads local profile or shows optional setup
- Setup screen gets a Skip button for guest access
- initApp() handles both profile and guest (anonymous) state
- Rate limiter uses anon key when no profile name exists
- Matches video: Free · Private · No sign-up badges"
del /F "%REPO%\.git\index.lock" 2>nul

echo.
echo === DONE! Push from GitHub Desktop or run: ===
echo git -C "%REPO%" push origin main
echo.
pause
