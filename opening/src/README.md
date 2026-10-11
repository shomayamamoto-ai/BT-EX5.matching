# オープニングムービーの作り方

`assets/opening/bt-ex5-opening.mp4`(1920×1080)と 720p 版(MP4・WebM)、`poster.jpg` は、次の手順で作っています。

## 映像(3DCG・いまの版)

- `opening3d.html` + `opening3d.js`(three.js 0.170)。`render(t)` が時刻 t(秒)の画面を描く(同じ t なら同じ画面)。
  - 立体: 金の塵(1800粒)・奥のぼけた光、ともる光、5つの光と尾、金の糸(チューブ)と巡る光、金属のロゴ(5つの弧・5つの点・内側の五角形)
  - 仕上げ: 光のにじみ(Unreal Bloom)、周辺減光、フィルムの粒、わずかな色ずれ。金属の映り込みは RoomEnvironment
  - 文字(字幕・五つの言葉・BT-EX5・一言)は HTML で重ねる(明朝は Shippori Mincho、BT-EX5 は Montserrat Light)
- 準備: このフォルダで `npm i three@0.170.0 @fontsource/shippori-mincho@5.1.0 @fontsource/montserrat@5.1.0`
- 確かめる: このフォルダで `python3 -m http.server` → `opening3d.html` を開くとそのまま再生。`?frame=9.2` でその時刻の1コマ
- 書き出し: 1920×1080 のページで `window.renderAt(t)` を 1/30 秒ずつ呼んで画面を撮る(Playwright。WebGL が使えるよう Chromium は `--use-angle=swiftshader --enable-unsafe-swiftshader`)。390 コマ

## 音

- `audio.py` で合成(陽音階の鐘、きらめき、背景の和音、ライザーのあとの一瞬の無音、9.0 秒の低い響き)。`python audio.py opening.wav`(numpy が必要)
- 映像のできごとは音に合わせてある: 0 秒 光、3.0 秒 分かれる、4.4 秒〜 糸、5.9 秒〜 光が巡る、9.0 秒 ロゴが決まる、13 秒 おわり

## 動画にする

```
ffmpeg -framerate 30 -i frames/f%04d.jpg -i opening.wav -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart bt-ex5-opening.mp4
ffmpeg -i bt-ex5-opening.mp4 -vf scale=1280:720 -c:v libx264 -crf 22 -c:a aac -b:a 128k -movflags +faststart bt-ex5-opening-720p.mp4
ffmpeg -i bt-ex5-opening.mp4 -vf scale=1280:720 -c:v libvpx-vp9 -crf 34 -b:v 0 -c:a libopus bt-ex5-opening-720p.webm
```

ログイン画面では 720p 版を流します(`opening/intro.js`)。もう一度見るときは `/opening/`。

## 前の版

`opening/opening.js` は、前の平面(SVG)の版です(同じ時間割)。
