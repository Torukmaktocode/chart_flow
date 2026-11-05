# Driver: descarga anualHistData via navegador de prueba, extrae b64 y hace merge
param(
  [string]$pair = "eurusd",           # eurusd | xauusd
  [string]$yearRange = "2016..2022",  # rango inclusivo
  [string]$symbol = "EURUSD"
)
$ErrorActionPreference = "Continue"
$env:AGENT_BROWSER_SESSION = "chartflow-test"
$step = 0
function LogStep($m) { Write-Host ("[" + (Get-Date -Format HH:mm:ss) + "] $m") }
$parts = $yearRange -split "\.\."; $years = [int]$parts[0]..[int]$parts[1]

# abrir pagina de referencia del par (tk vigente en primera peticion)
agent-browser navigate "https://www.histdata.com/download-free-forex-historical-data/?/ascii/1-minute-bar-quotes/$pair/2100" | Out-Null
agent-browser wait 2500 | Out-Null
agent-browser eval "JSON.stringify((()=>{window.__hdPair='$pair';return 'set:'+'$pair';})())" | Out-Null
# definir __hdFetch en el contexto del par
Get-Content "$env:TEMP\opencode\hd-fn.js" | agent-browser eval --stdin | Out-Null

foreach ($y in $years) {
  $step++
  LogStep "=== ANO $y (paso $step/$($years.Count)) ==="
  agent-browser eval "window.__hdFetch($y); 'kicked'" | Out-Null
  agent-browser wait 5000 | Out-Null
  $state = agent-browser eval "String(window.__hdState||'pendiente')"
  LogStep "estado: $state"
  if ($state -notmatch "ZIP-OK") { LogStep "PROBLEMA ano $y - continuar"; continue }
  $len = [int](agent-browser eval "String(window.__hdZip).length").Trim('"')
  $b64file = "$env:TEMP\opencode\$pair-$y-M1.b64"
  if (Test-Path $b64file) { Remove-Item $b64file -Force }
  $sb = New-Object System.Text.StringBuilder
  $pieces = [Math]::Ceiling($len/300000)
  for ($i = 0; $i -lt $pieces; $i++) {
    $ofs = $i*300000
    $piece = agent-browser eval "String(window.__hdZip).slice($ofs, $($ofs+300000))"
    if ([string]::IsNullOrEmpty($piece)) { break }
    [void]$sb.Append(($piece -replace '^"','' -replace '"$',''))
  }
  $sb.ToString() | Set-Content -Path $b64file -NoNewline -Encoding Ascii
  LogStep "b64 extraido: $((Get-Item $b64file).Length) bytes"
  # decode + unzip + merge
  $zip = "$env:TEMP\opencode\hd-$pair\$pair$y.zip"
  New-Item -ItemType Directory -Force -Path "$env:TEMP\opencode\hd-$pair" | Out-Null
  [IO.File]::WriteAllBytes($zip, [Convert]::FromBase64String((Get-Content $b64file -Raw)))
  try { Expand-Archive $zip -DestinationPath "$env:TEMP\opencode\hd-$pair\u$y" -Force } catch { LogStep "ZIP invalido ano $y"; continue }
  $csv = Get-ChildItem "$env:TEMP\opencode\hd-$pair\u$y" -Filter *.csv | Select-Object -First 1
  if ($csv) { node "$env:TEMP\opencode\merge-histdata.js" $csv.FullName $symbol }
  else { LogStep "sin CSV en $y (posible tabla vacia)" }
  Remove-Item "$env:TEMP\opencode\hd-$pair\u$y" -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $b64file -Force -ErrorAction SilentlyContinue
}
LogStep "=== FIN $symbol ==="
