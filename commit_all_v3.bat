@echo off
set REPO=C:\Users\Sokha\OneDrive\Documents\GitHub\khelper\khelper

echo === Cleaning git locks ===
del /F "%REPO%\.git\index.lock" 2>nul
del /F "%REPO%\.git\objects\maintenance.lock" 2>nul

echo === Staging index.html ===
git -C "%REPO%" add index.html
del /F "%REPO%\.git\index.lock" 2>nul

echo === Committing ===
git -C "%REPO%" commit -m "feat: complete UI overhaul matching video design

AUTH SPLASH
- No login required — language pill is the only CTA
- Badge 3: Trusted -> No sign-up / minn team tror kornee
- Enter app instantly by tapping km / kr / en
- Optional profile setup (name + visa expiry) with Skip button
- enterApp() flow: local profile check -> setup or chat

CHAT UI (matching video screenshots)
- User bubbles: removed 'You' meta label, bare pill only
- Mobile header: small lantern SVG + italic wordmark (left) + hamburger (right)
- AI response: hotline card auto-detected from phone numbers in reply
  - Supports: 1393, 1345, 1350, 119, 1366, 1644-0644, embassy...
  - Call button links tel: directly
- Source citation appended by triage category (VISA, WORK, HEALTH...)

VISA RING CARD (home screen)
- Logged profile: full ring with months remaining + Renew button
- Guest/anonymous: soft prompt card -> tap to add visa date

BACKEND UNCHANGED
- All API calls, rate limiting, multilingual prompt preserved"
del /F "%REPO%\.git\index.lock" 2>nul

echo.
echo === Pushing to GitHub (triggers Netlify deploy) ===
git -C "%REPO%" push origin main

echo.
echo ============================================
echo  DONE! Check khelper.netlify.app in ~60s
echo ============================================
pause
