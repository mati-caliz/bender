# Ajusta capturas de pantalla al tamano exacto que exige la Chrome Web Store.
# Escala cada imagen para que entre completa y la centra sobre un fondo solido.
#
#   powershell -ExecutionPolicy Bypass -File scripts/fit-screenshots.ps1
#
# Entrada:  store/screenshots/raw/*.png|jpg
# Salida:   store/screenshots/*.png  (1280x800)

param(
  [int]$Width = 1280,
  [int]$Height = 800,
  [string]$Background = '#0a0d16'  # --bg del tema oscuro de Bender
)

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$inDir = Join-Path $root 'store\screenshots\raw'
$outDir = Join-Path $root 'store\screenshots'

if (-not (Test-Path $inDir)) {
  New-Item -ItemType Directory -Force -Path $inDir | Out-Null
  Write-Host "Cree $inDir. Pone ahi tus capturas y volve a correr el script."
  exit 0
}

$files = Get-ChildItem -Path $inDir -File | Where-Object { $_.Extension -match '^\.(png|jpg|jpeg)$' }
if ($files.Count -eq 0) {
  Write-Host "No hay imagenes en $inDir"
  exit 0
}

$bg = [System.Drawing.ColorTranslator]::FromHtml($Background)

foreach ($file in $files) {
  $src = [System.Drawing.Image]::FromFile($file.FullName)
  try {
    $canvas = New-Object System.Drawing.Bitmap($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    try {
      $g.Clear($bg)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

      # Escala para entrar completa, sin recortar y sin agrandar de mas.
      $scale = [Math]::Min($Width / $src.Width, $Height / $src.Height)
      $w = [int][Math]::Round($src.Width * $scale)
      $h = [int][Math]::Round($src.Height * $scale)
      $x = [int](($Width - $w) / 2)
      $y = [int](($Height - $h) / 2)
      $g.DrawImage($src, $x, $y, $w, $h)
    } finally {
      $g.Dispose()
    }

    $out = Join-Path $outDir ($file.BaseName + '.png')
    $canvas.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Host ("{0}  {1}x{2} -> {3}x{4}" -f $file.Name, $src.Width, $src.Height, $Width, $Height)
  } finally {
    $src.Dispose()
  }
}

Write-Host ""
Write-Host "Listas en $outDir"
