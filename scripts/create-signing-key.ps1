param([string]$OutputDirectory = (Join-Path $env:USERPROFILE 'Nasie-signing-private'))
$ErrorActionPreference = 'Stop'
$keyToolCommand = Get-Command keytool -ErrorAction SilentlyContinue
if (-not $keyToolCommand) { throw 'Java JDK 17 is required. Install it, open a new PowerShell, then run this script again.' }
$signingDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $signingDirectory) { throw 'Output directory already exists. Keep the old key; do not replace it for updates.' }
New-Item -ItemType Directory -Path $signingDirectory | Out-Null
$randomBytes = New-Object byte[] 32
$randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
$randomGenerator.GetBytes($randomBytes)
$randomGenerator.Dispose()
$signingPassword = [Convert]::ToBase64String($randomBytes)
$env:NASIE_SIGNING_PASSWORD = $signingPassword
try {
 $keyPath = Join-Path $signingDirectory 'nasie-release.jks'
 & $keyToolCommand.Source -genkeypair -keystore $keyPath -storetype JKS -alias nasie -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Nasie Offline' -storepass:env NASIE_SIGNING_PASSWORD -keypass:env NASIE_SIGNING_PASSWORD
 if ($LASTEXITCODE -ne 0) { throw 'Key generation failed. No APK was built.' }
 $utf8 = New-Object System.Text.UTF8Encoding($false)
 [IO.File]::WriteAllText((Join-Path $signingDirectory 'ANDROID_KEYSTORE_BASE64.txt'),[Convert]::ToBase64String([IO.File]::ReadAllBytes($keyPath)),$utf8)
 [IO.File]::WriteAllText((Join-Path $signingDirectory 'ANDROID_STORE_PASSWORD.txt'),$signingPassword,$utf8)
 [IO.File]::WriteAllText((Join-Path $signingDirectory 'ANDROID_KEY_PASSWORD.txt'),$signingPassword,$utf8)
 [IO.File]::WriteAllText((Join-Path $signingDirectory 'ANDROID_KEY_ALIAS.txt'),'nasie',$utf8)
 Write-Host "Signing key created in: $signingDirectory"
 Write-Host 'Keep a private backup. Put the four TXT contents in GitHub Actions secrets. Never upload these files to repository code.'
} finally {
 Remove-Item Env:NASIE_SIGNING_PASSWORD -ErrorAction SilentlyContinue
}
