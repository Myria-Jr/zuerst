param(
    [string]$JavaHome = $env:JAVA_HOME,
    [string]$Sdk = $env:ANDROID_HOME,
    [string]$BuildTools = '36.0.0'
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$unsigned = Join-Path $project 'android/app/build/outputs/apk/release/app-release-unsigned.apk'
$aligned = Join-Path $project 'android/app/build/outputs/apk/release/app-release-aligned.apk'
$keytool = Join-Path $JavaHome 'bin/keytool.exe'
$signer = Join-Path $Sdk "build-tools/$BuildTools/apksigner.bat"
$zipalign = Join-Path $Sdk "build-tools/$BuildTools/zipalign.exe"
foreach ($path in $unsigned, $keytool, $signer, $zipalign) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Datei fehlt: $path" }
}
& $zipalign -f -P 16 4 $unsigned $aligned

$vault = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Odkaz Labs/Zuerst/Android Signing'
$key = Join-Path $vault 'release.p12'
$protectedPassword = Join-Path $vault 'password.dpapi'
$hasKey = Test-Path -LiteralPath $key -PathType Leaf
$hasPassword = Test-Path -LiteralPath $protectedPassword -PathType Leaf
if ($hasKey -ne $hasPassword) { throw 'Der vorhandene Signaturschlüssel ist unvollständig. Stelle Schlüssel und geschütztes Passwort wieder her.' }

$destination = Join-Path $project 'public/downloads'
$apk = Join-Path $destination 'zuerst-android.apk'
$previousPassword = [Environment]::GetEnvironmentVariable('ZUERST_ANDROID_SIGNING_PASSWORD', 'Process')
try {
    if ($hasKey) {
        $secure = Get-Content -Raw -LiteralPath $protectedPassword | ConvertTo-SecureString
        $env:ZUERST_ANDROID_SIGNING_PASSWORD = [Net.NetworkCredential]::new('', $secure).Password
    } else {
        New-Item -ItemType Directory -Path $vault -Force | Out-Null
        $env:ZUERST_ANDROID_SIGNING_PASSWORD = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
        $secure = ConvertTo-SecureString $env:ZUERST_ANDROID_SIGNING_PASSWORD -AsPlainText -Force
        & $keytool -genkeypair -storetype PKCS12 -keystore $key -alias zuerst-release -storepass:env ZUERST_ANDROID_SIGNING_PASSWORD -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Odkaz Labs, OU=Zuerst'
        $secure | ConvertFrom-SecureString | Set-Content -LiteralPath $protectedPassword -NoNewline
    }
    $env:JAVA_HOME = $JavaHome
    New-Item -ItemType Directory -Path $destination -Force | Out-Null
    & $signer sign --ks $key --ks-key-alias zuerst-release --ks-pass 'env:ZUERST_ANDROID_SIGNING_PASSWORD' --v4-signing-enabled false --out $apk $aligned
    & $signer verify --verbose --print-certs $apk
    Get-FileHash -Algorithm SHA256 -LiteralPath $apk | Select-Object Hash, Path
} finally {
    [Environment]::SetEnvironmentVariable('ZUERST_ANDROID_SIGNING_PASSWORD', $previousPassword, 'Process')
}
