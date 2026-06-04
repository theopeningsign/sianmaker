# 사인메이커 개발 서버 시작 (백엔드 + 프론트엔드)
# 실행: PowerShell에서  ./start-dev.ps1   또는  우클릭 > PowerShell로 실행
Set-Location $PSScriptRoot

Write-Host "[1/2] 백엔드 (Flask :5000) 시작..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit','-Command',"Set-Location '$PSScriptRoot'; python server.py"

Write-Host "[2/2] 프론트엔드 (live-server :3000) 시작..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList '-NoExit','-Command',"Set-Location '$PSScriptRoot'; npx live-server . --port=3000 --no-browser --quiet"

Start-Sleep -Seconds 4
Start-Process "http://localhost:3000/step1-form.html"

Write-Host "두 개의 PowerShell 창이 서버입니다. 닫지 마세요." -ForegroundColor Yellow
Write-Host "종료하려면 그 창들을 닫으면 됩니다." -ForegroundColor Yellow
