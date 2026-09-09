@echo off
title Push Changes to GitHub - Collage-managemnet
echo ========================================================
echo  MGI Portal - Push to GitHub Repository
echo  Target: https://github.com/arvindmishra91357-max/Collage-managemnet
echo ========================================================
echo.

set "PATH=C:\Users\arvin\AppData\Local\Programs\Git\cmd;%PATH%"

echo Staging all files...
git add -A

echo Committing any remaining changes...
git commit -m "Fix APK download, resolve notices modal navigation glitch, and configure Netlify" 2>nul

echo Pushing to GitHub (arvindmishra91357-max/Collage-managemnet)...
git push -u origin main --force

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] Sabhi changes aapki puraani repo me push ho gaye!
    echo ========================================================
) else (
    echo.
    echo ========================================================
    echo  [NOTE] Agar GitHub login prompt aaye to browser me sign in karein.
    echo ========================================================
)

echo.
pause
