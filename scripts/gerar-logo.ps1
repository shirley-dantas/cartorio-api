Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath {
    param($x, $y, $w, $h, $radius)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $d = $radius * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-Logo {
    param([int]$size, [string]$outPath)

    $bmp = [System.Drawing.Bitmap]::new($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.Clear([System.Drawing.Color]::Transparent)

    $radius = $size * 0.22
    $rectPath = New-RoundedRectPath -x 0 -y 0 -w $size -h $size -radius $radius

    # sober muted purple, near-solid with a very subtle vertical gradient
    $bgp1 = [System.Drawing.Point]::new(0,0)
    $bgp2 = [System.Drawing.Point]::new(0,$size)
    $bgBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($bgp1, $bgp2, [System.Drawing.Color]::FromArgb(255,42,27,66), [System.Drawing.Color]::FromArgb(255,58,38,92))
    $g.FillPath($bgBrush, $rectPath)

    # faint diagonal sheen, very subtle
    $g.SetClip($rectPath)
    $shp1 = [System.Drawing.Point]::new(0,0)
    $shp2 = [System.Drawing.Point]::new($size,[int]($size*0.7))
    $sheenBrush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($shp1, $shp2, [System.Drawing.Color]::FromArgb(18,255,255,255), [System.Drawing.Color]::FromArgb(0,255,255,255))
    $g.FillPath($sheenBrush, $rectPath)
    $g.ResetClip()

    $sf = [System.Drawing.StringFormat]::new()
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    # small tracked label "EQUIPE"
    $labelText = "E Q U I P E"
    $labelSize = [single]($size * 0.072)
    $labelFont = [System.Drawing.Font]::new("Segoe UI", $labelSize, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(235,196,168,110))
    $labelPt = [System.Drawing.PointF]::new([single]($size/2.0), [single]($size*0.335))
    $g.DrawString($labelText, $labelFont, $labelBrush, $labelPt, $sf)

    # thin rule under label
    $rulePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(140,196,168,110), [Math]::Max(1.5,$size*0.004))
    $ruleY = [single]($size*0.385)
    $ruleHalf = $size*0.09
    $g.DrawLine($rulePen, [single]($size/2.0-$ruleHalf), $ruleY, [single]($size/2.0+$ruleHalf), $ruleY)

    # big wordmark "PRIME"
    $primeSize = [single]($size * 0.225)
    $primeFont = [System.Drawing.Font]::new("Century Gothic", $primeSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $primeShadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(60,0,0,0))
    $shadowPt = [System.Drawing.PointF]::new([single]($size/2.0+$size*0.006), [single]($size*0.565+$size*0.012))
    $g.DrawString("PRIME", $primeFont, $primeShadow, $shadowPt, $sf)
    $primeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $primePt = [System.Drawing.PointF]::new([single]($size/2.0), [single]($size*0.565))
    $g.DrawString("PRIME", $primeFont, $primeBrush, $primePt, $sf)

    # thin gold underline beneath PRIME
    $underlinePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220,196,168,110), [Math]::Max(2,$size*0.008))
    $ulY = [single]($size*0.70)
    $ulHalf = $size*0.16
    $g.DrawLine($underlinePen, [single]($size/2.0-$ulHalf), $ulY, [single]($size/2.0+$ulHalf), $ulY)

    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$outDir = "X:\cartorio-projeto\icons"
New-Logo -size 1024 -outPath "$outDir\icon-master.png"
New-Logo -size 512  -outPath "$outDir\icon-512.png"
New-Logo -size 192  -outPath "$outDir\icon-192.png"
New-Logo -size 180  -outPath "$outDir\apple-touch-icon.png"
New-Logo -size 32   -outPath "$outDir\favicon-32.png"
Write-Output "Logos gerados em $outDir"
