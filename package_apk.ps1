$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "========================================================"
Write-Host " MGI CYBER PORTAL - ANDROID APK BUILDER & PACKAGER"
Write-Host "========================================================"

# 1. Sync updated public assets to staging_apk/assets/www
$stagingWww = Join-Path $scriptDir "staging_apk\assets\www"
if (-not (Test-Path $stagingWww)) { New-Item -ItemType Directory -Path $stagingWww -Force | Out-Null }

Write-Host "[1/6] Syncing latest web assets to APK www..."
Get-ChildItem -Path "public" -Recurse | Where-Object { 
    -not $_.PSIsContainer -and 
    -not $_.FullName.Contains("\apk\") -and 
    -not $_.Name.EndsWith(".apk") -and
    -not $_.Name.StartsWith("_headers") -and
    -not $_.Name.StartsWith("_redirects")
} | ForEach-Object {
    $rel = $_.FullName.Substring((Resolve-Path "public").Path.Length + 1)
    $dest = Join-Path $stagingWww $rel
    $destDir = Split-Path $dest -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Copy-Item $_.FullName $dest -Force
}

# 2. Check classes.dex at root of staging_apk
$classesDex = Join-Path $scriptDir "staging_apk\classes.dex"
if (-not (Test-Path $classesDex)) {
    throw "[ERROR] classes.dex not found at $classesDex! It must be at root of staging_apk."
}
Write-Host "[2/6] Verified classes.dex at root of staging ($((Get-Item $classesDex).Length) bytes)."

# 3. Compile ApkPackager C# engine if not already in memory
if (-not ([System.Management.Automation.PSTypeName]'ApkPackager').Type) {
    $csCode = Get-Content (Join-Path $scriptDir "ApkPackager.cs") -Raw
    Add-Type -TypeDefinition $csCode -Language CSharp
}

$unaligned = Join-Path $scriptDir "android-build\unaligned.apk"
if (-not (Test-Path "android-build")) { New-Item -ItemType Directory -Path "android-build" -Force | Out-Null }
if (Test-Path $unaligned) { Remove-Item $unaligned -Force }

Write-Host "[3/6] Packaging clean APK archive with uncompressed resources.arsc..."
[ApkPackager]::CreateApk((Join-Path $scriptDir "staging_apk"), $unaligned)
Write-Host "Packaging successful: $((Get-Item $unaligned).Length) bytes."

# 4. Zipalign (4-byte alignment with -p)
$buildTools = "C:\Users\arvin\AppData\Local\Android\Sdk\build-tools\35.0.0"
$zipalign = Join-Path $buildTools "zipalign.exe"
$aligned = Join-Path $scriptDir "android-build\aligned.apk"
if (Test-Path $aligned) { Remove-Item $aligned -Force }

Write-Host "[4/6] Zipaligning APK on 4-byte boundaries..."
& $zipalign -f -p 4 $unaligned $aligned

# 5. Keystore & Signing with apksigner (v1 + v2 + v3)
$jreBin = "C:\Users\arvin\AppData\Local\Programs\jdk-17.0.10+7-jre\bin"
$java = Join-Path $jreBin "java.exe"
$keytool = Join-Path $jreBin "keytool.exe"
$apksigner = Join-Path $buildTools "lib\apksigner.jar"
$keystore = Join-Path $scriptDir "android-build\release.keystore"

if (-not (Test-Path $keystore)) {
    Write-Host "Generating release keystore..."
    & $keytool -genkeypair -v -keystore $keystore -alias mgikey -keyalg RSA -keysize 2048 -validity 10000 -storepass mgiportal123 -keypass mgiportal123 -dname "CN=Mishra Group Institute, OU=Cyber Security, O=MGI, L=Surat, ST=Gujarat, C=IN"
}

$signed = Join-Path $scriptDir "MGI_Student_Portal.apk"
if (Test-Path $signed) { Remove-Item $signed -Force }

Write-Host "[5/6] Signing APK with v1 + v2 + v3 schemes..."
& $java -jar $apksigner sign `
    --ks $keystore `
    --ks-pass pass:mgiportal123 `
    --key-pass pass:mgiportal123 `
    --ks-key-alias mgikey `
    --min-sdk-version 21 `
    --out $signed `
    $aligned

# 6. Verification and Deployment
Write-Host "[6/6] Verifying signatures and package integrity..."
& $java -jar $apksigner verify --verbose --min-sdk-version 21 $signed

Copy-Item $signed (Join-Path $scriptDir "public\apk\MGI_Student_Portal.apk") -Force
Copy-Item $signed (Join-Path $scriptDir "public\MGI_Student_Portal.apk") -Force

Write-Host "========================================================"
Write-Host " [SUCCESS] Signed Android APK Generated Successfully!"
Write-Host " Output files:"
Write-Host "  - MGI_Student_Portal.apk ($((Get-Item $signed).Length) bytes)"
Write-Host "  - public\apk\MGI_Student_Portal.apk"
Write-Host "  - public\MGI_Student_Portal.apk"
Write-Host "========================================================"
