$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$rootDir = Split-Path -Parent $PSScriptRoot
$cloudflared = Join-Path $rootDir "cloudflared.exe"
$tunnelLog = Join-Path $rootDir "tunnel.log"
$urlFile = Join-Path $rootDir "目前外網網址.txt"

# 0. 先清除殘留的舊 cloudflared 避免衝突
Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# 1. 檢查後端 8000 是否已在運行
$backendRunning = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if (-not $backendRunning) {
    Write-Host "[1/3] 正在啟動 Python 後端伺服器 (Port 8000)..." -ForegroundColor Yellow
    $backendDir = Join-Path $rootDir "Python_BackEnd"
    $pythonExe = Join-Path $backendDir "venv\Scripts\python.exe"
    if (-not (Test-Path $pythonExe)) {
        $pythonExe = "python.exe"
    }
    Start-Process -FilePath $pythonExe -ArgumentList "-m uvicorn main:app --host 0.0.0.0 --port 8000" -WorkingDirectory $backendDir -WindowStyle Hidden
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/3] Python 後端伺服器 (Port 8000) 運行中" -ForegroundColor Green
}

# 2. 啟動 Cloudflare 穿透
Write-Host "[2/3] 正在連線 Cloudflare 雲端節點，取得專屬外網網址..." -ForegroundColor Yellow
if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force }

$proc = Start-Process -FilePath $cloudflared -ArgumentList "tunnel --url http://localhost:8000 --logfile `"$tunnelLog`"" -PassThru -WindowStyle Hidden

# 3. 監聽 log 抓取網址
$tunnelUrl = $null
$timeoutSeconds = 25
$elapsed = 0

while ($elapsed -lt $timeoutSeconds) {
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5
    if (Test-Path $tunnelLog) {
        $content = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
        if ($content -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $tunnelUrl = $matches[1]
            break
        }
    }
    if ($proc.HasExited) {
        break
    }
}

if ($tunnelUrl) {
    Write-Host ""
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host "  ✅ 外網網頁版連線成功！" -ForegroundColor Green
    Write-Host "  🔗 您的專屬外網網址：" -ForegroundColor Yellow
    Write-Host "     $tunnelUrl" -ForegroundColor Cyan
    Write-Host "========================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  * 網址已自動複製到剪貼簿 (在 LINE / 記事本按 Ctrl+V 即可貼上)" -ForegroundColor White
    Write-Host "  * 網址已儲存至：目前外網網址.txt" -ForegroundColor Gray
    Write-Host "  * 注意：網址剛產生時，全球 DNS 同步需約 5~10 秒，若打開顯示查不到，請重新整理網頁！" -ForegroundColor Yellow
    Write-Host "  * 請勿關閉此黑色視窗（最小化即可），關閉後外網連線將中斷。" -ForegroundColor Yellow
    Write-Host ""

    # 存檔 & 剪貼簿
    Set-Content -Path $urlFile -Value $tunnelUrl -Encoding UTF8
    try { Set-Clipboard -Value $tunnelUrl } catch {}

    # 等候 3 秒讓 DNS 同步再開瀏覽器，避免剛開時 DNS 尚未生效
    Start-Sleep -Seconds 3
    Start-Process $tunnelUrl

    try {
        Write-Host "👉 正在保持連線中... (按 Ctrl+C 可停止外網連線)" -ForegroundColor Green
        while (-not $proc.HasExited) {
            Start-Sleep -Seconds 2
        }
    } finally {
        if ($proc -and -not $proc.HasExited) {
            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        }
        Stop-Process -Name "cloudflared" -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "❌ 無法取得外網網址，請確認網路連線是否正常。" -ForegroundColor Red
    if (Test-Path $tunnelLog) {
        Get-Content $tunnelLog | Select-Object -Last 10
    }
}
