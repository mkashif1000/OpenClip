# Rebuild only the synthetic local media owned by the workflow capture fixture.
# Requires FFmpeg with libx264 and drawtext; uses the installed Windows font.
$ErrorActionPreference = 'Stop'
$font = 'C\:/Windows/Fonts/segoeuib.ttf'
$sourceFilter = "drawbox=x=455:y=70:w=370:h=580:color=0x242424:t=fill,drawbox=x=479:y=94:w=322:h=532:color=0x555555:t=2,drawtext=fontfile='$font':text='OPENCLIP':fontsize=23:fontcolor=0xaaaaaa:x=(w-tw)/2:y=148,drawtext=fontfile='$font':text='CREATE':fontsize=66:fontcolor=white:x=(w-tw)/2:y=262,drawtext=fontfile='$font':text='WITH INTENT.':fontsize=38:fontcolor=white:x=(w-tw)/2:y=348,drawtext=fontfile='$font':text='LOCAL DEMO RECORDING':fontsize=16:fontcolor=0xaaaaaa:x=(w-tw)/2:y=526"

ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'color=c=0x111111:s=1280x720:r=30:d=90' -vf $sourceFilter -c:v libx264 -preset fast -crf 25 -pix_fmt yuv420p -movflags +faststart (Join-Path $PSScriptRoot 'workflow-source.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Source media generation failed.' }

$titles = @(@('START', 'SMALL.'), @('MAKE IT', 'USEFUL.'), @('SHARE', 'THE STORY.'))
foreach ($index in 0..2) {
  $first = $titles[$index][0]
  $second = $titles[$index][1]
  $number = $index + 1
  $filter = "drawbox=x=24:y=24:w=312:h=592:color=0x242424:t=fill,drawbox=x=40:y=40:w=280:h=560:color=0x666666:t=1,drawtext=fontfile='$font':text='OPENCLIP':fontsize=18:fontcolor=0xaaaaaa:x=(w-tw)/2:y=118,drawtext=fontfile='$font':text='$first':fontsize=44:fontcolor=white:x=(w-tw)/2:y=256,drawtext=fontfile='$font':text='$second':fontsize=37:fontcolor=white:x=(w-tw)/2:y=317,drawtext=fontfile='$font':text='SYNTHETIC DEMO 0$number':fontsize=14:fontcolor=0xaaaaaa:x=(w-tw)/2:y=501"
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i 'color=c=0x111111:s=360x640:r=30:d=30' -vf $filter -c:v libx264 -preset fast -crf 25 -pix_fmt yuv420p -movflags +faststart (Join-Path $PSScriptRoot "workflow-output-$number.mp4")
  if ($LASTEXITCODE -ne 0) { throw "Output media generation failed: $number" }
}
