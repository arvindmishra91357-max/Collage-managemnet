$url = "https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.10+7/OpenJDK17U-jre_x64_windows_hotspot_17.0.10_7.zip"
$zipPath = "$env:TEMP\jre17.zip"
$destDir = "C:\Users\arvin\AppData\Local\Programs"

Write-Host "Downloading OpenJDK JRE 17 from $url..."
curl.exe -fSL $url -o $zipPath

if (Test-Path $zipPath) {
    Write-Host "Extracting to $destDir..."
    Expand-Archive -Path $zipPath -DestinationPath $destDir -Force
    Remove-Item $zipPath -Force
    Write-Host "Extraction complete!"
    Get-ChildItem $destDir | Select-Object Name
} else {
    Write-Error "Failed to download JRE zip!"
}
