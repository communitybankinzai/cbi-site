# CBI 告知ポスター（A0縦 841×1189mm）PDF 生成スクリプト
# 使い方: powershell -ExecutionPolicy Bypass -File site\poster\build.ps1
#         （パターン2は -Name cbi-poster-a0-b を付ける）
# 前提  : Google Chrome がインストール済み／Google Fonts 取得のためオンラインであること
#         （オフラインで実行すると書体が代替フォントに置き換わる）

param([string]$Name = "cbi-poster-a0")

$ErrorActionPreference = "Stop"

$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { throw "Chrome が見つかりません: $chrome" }


$src = Join-Path $PSScriptRoot "$Name.html"
$out = Join-Path $PSScriptRoot "$Name.pdf"
$url = "file:///" + $src.Replace([char]92, [char]47)

& $chrome --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=15000 "--print-to-pdf=$out" $url | Out-Null

if (-not (Test-Path $out)) { throw "PDF の生成に失敗しました" }
$size = [math]::Round((Get-Item $out).Length / 1MB, 2)
Write-Host "出力: $out ($size MB)"
