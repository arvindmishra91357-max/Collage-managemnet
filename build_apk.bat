@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo  MISHRA GROUP INSTITUTE - ANDROID APK BUILD ENGINE
echo ========================================================

set "JAVA_HOME=C:\Program Files\Java\jdk-19"
set "PATH=%JAVA_HOME%\bin;%PATH%"
set "SDK_DIR=C:\Users\Soul Hacker\AppData\Local\Android\Sdk"
set "BUILD_TOOLS=%SDK_DIR%\build-tools\35.0.0"
set "PLATFORM=%SDK_DIR%\platforms\android-36\android.jar"

if not exist "%PLATFORM%" (
    echo [ERROR] Android SDK platform android.jar not found at %PLATFORM%
    pause
    exit /b 1
)

echo [1/7] Syncing web assets to APK www directory...
if not exist "android-build\assets\www" mkdir "android-build\assets\www"
xcopy /E /I /Y /Q "public\*" "android-build\assets\www\" >nul

echo [2/7] Generating R.java with AAPT...
"%BUILD_TOOLS%\aapt.exe" package -f -m -J "android-build\src" -M "android-build\AndroidManifest.xml" -S "android-build\res" -I "%PLATFORM%"
if errorlevel 1 (
    echo [ERROR] AAPT R.java generation failed.
    pause
    exit /b 1
)

echo [3/7] Compiling Java classes with javac...
if not exist "android-build\bin\classes" mkdir "android-build\bin\classes"
"%JAVA_HOME%\bin\javac.exe" -d "android-build\bin\classes" -cp "%PLATFORM%" "android-build\src\com\mgi\cyberportal\R.java" "android-build\src\com\mgi\cyberportal\MainActivity.java" --release 8
if errorlevel 1 (
    echo [ERROR] Java compilation failed.
    pause
    exit /b 1
)

echo [4/7] Dexing bytecode with D8...
"%JAVA_HOME%\bin\jar.exe" cvf "android-build\bin\app.jar" -C "android-build\bin\classes" . >nul
call "%BUILD_TOOLS%\d8.bat" --output "android-build\bin" --lib "%PLATFORM%" "android-build\bin\app.jar"
if errorlevel 1 (
    echo [ERROR] D8 dexing failed.
    pause
    exit /b 1
)

echo [5/7] Packaging APK resources with AAPT...
"%BUILD_TOOLS%\aapt.exe" package -f -M "android-build\AndroidManifest.xml" -S "android-build\res" -A "android-build\assets" -I "%PLATFORM%" -F "android-build\bin\unaligned.apk"
"%BUILD_TOOLS%\aapt.exe" add "android-build\bin\unaligned.apk" "android-build\bin\classes.dex" >nul

echo [6/7] Zipaligning APK...
"%BUILD_TOOLS%\zipalign.exe" -f 4 "android-build\bin\unaligned.apk" "android-build\bin\aligned.apk"

echo [7/7] Signing APK with Release Key...
if not exist "android-build\release.keystore" (
    "%JAVA_HOME%\bin\keytool.exe" -genkeypair -v -keystore "android-build\release.keystore" -alias mgikey -keyalg RSA -keysize 2048 -validity 10000 -storepass mgiportal123 -keypass mgiportal123 -dname "CN=Mishra Group Institute, OU=Cyber Security, O=MGI, L=Surat, ST=Gujarat, C=IN" >nul
)

call "%BUILD_TOOLS%\apksigner.bat" sign --ks "android-build\release.keystore" --ks-pass pass:mgiportal123 --key-pass pass:mgiportal123 --ks-key-alias mgikey --out "MGI_Student_Portal.apk" "android-build\bin\aligned.apk"

copy /Y "MGI_Student_Portal.apk" "public\apk\MGI_Student_Portal.apk" >nul

echo ========================================================
echo  [SUCCESS] Signed APK Generated: MGI_Student_Portal.apk
echo  Also copied to: public\apk\MGI_Student_Portal.apk
echo ========================================================
