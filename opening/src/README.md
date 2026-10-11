# オープニングムービーの作り方

`assets/opening/bt-ex5-opening.mp4`(1920×1080)と 720p 版(MP4・WebM)、`poster.jpg` は、次の手順で作っています。

## 映像(3DCG・いまの版)

- `opening3d.html` + `opening3d.js`(three.js 0.170)。`render(t)` が時刻 t(秒)の画面を描く(同じ t なら同じ画面)。
  - 立体: 金の塵(1800粒)・奥のぼけた光、ともる光、5つの光と尾、金の糸(チューブ)と巡る光、金属のロゴ(5つの弧と丸いはし・5つの点・内側の五角形。太さは `logo3d.html` と同じ割合)、決まる瞬間の金の火の粉(320粒)と、うしろで回る後光
  - 暗転(始まりと終わり)は、色の調整(トーンマッピング)のあとの最後のパスでかける。前でかけると明るい金が残って黒まで落ちない。12.0 秒から暗くなり 12.75 秒で真っ黒
  - 巡る光は5つを五角形のまわりに等しい間で置き、同じ速さで辺から辺へ移す(`getPointAt` で長さに沿って)
  - うすく出す・まだ見えない透明なもの(内側の五角形・金の糸)は奥行きを書かない(`depthWrite: false`)。書くと、うしろの光をさえぎって黒い線に見える
  - 仕上げ: 光のにじみ(Unreal Bloom)、周辺減光、フィルムの粒、わずかな色ずれ。金属の映り込みは RoomEnvironment
  - 文字(字幕・五つの言葉・BT-EX5・一言)は HTML で重ねる(明朝は Shippori Mincho、BT-EX5 は Montserrat Light)
- 準備: このフォルダで `npm i three@0.170.0 @fontsource/shippori-mincho@5.1.0 @fontsource/montserrat@5.1.0`
- 確かめる: このフォルダで `python3 -m http.server` → `opening3d.html` を開くとそのまま再生。`?frame=9.2` でその時刻の1コマ
- 書き出し: 1920×1080 のページで `window.renderAt(t)` を 1/30 秒ずつ呼んで画面を PNG で撮る(Playwright。WebGL が使えるよう Chromium は `--use-angle=swiftshader --enable-unsafe-swiftshader`)。390 コマ(1コマ約4秒)

## 音

- `audio.py` で合成(陽音階の鐘、きらめき、背景の和音、ライザーのあとの一瞬の無音、9.0 秒の低い響き)。`python audio.py opening.wav`(numpy が必要)
- 映像のできごとは音に合わせてある: 0 秒 光、3.0 秒 分かれる、4.4 秒〜 糸、5.9 秒〜 光が巡る、9.0 秒 ロゴが決まる、13 秒 おわり

## 動画にする(画質を落とさない設定)

- 描画は 4 倍のなめらか描画(MSAA)と 16bit の中間バッファ、暗い所の段差を消すディザ入り。1コマずつ PNG(劣化なし)で撮る
- 圧縮は暗い場面に強い設定(aq-mode=3)で、ノイズ消しはかけない

```
VF="scale=out_color_matrix=bt709:out_range=tv,format=yuv420p"
X="-x264-params aq-mode=3:aq-strength=1.0:deblock=-1,-1 -colorspace bt709 -color_primaries bt709 -color_trc bt709"
ffmpeg -framerate 30 -i frames/f%04d.png -i opening.wav -vf "$VF" -c:v libx264 -preset veryslow -crf 15 -tune film $X -c:a aac -b:a 192k -shortest -movflags +faststart bt-ex5-opening.mp4
ffmpeg -framerate 30 -i frames/f%04d.png -i opening.wav -vf "scale=1280:720:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p" -c:v libx264 -preset veryslow -crf 17 -tune film $X -c:a aac -b:a 160k -shortest -movflags +faststart bt-ex5-opening-720p.mp4
ffmpeg -framerate 30 -i frames/f%04d.png -i opening.wav -vf "$VF" -c:v libvpx-vp9 -crf 24 -b:v 0 -row-mt 1 -cpu-used 1 -c:a libopus -b:a 128k -shortest bt-ex5-opening.webm
ffmpeg -framerate 30 -i frames/f%04d.png -i opening.wav -vf "scale=1280:720:flags=lanczos,format=yuv420p" -c:v libvpx-vp9 -crf 28 -b:v 0 -row-mt 1 -cpu-used 1 -c:a libopus -b:a 112k -shortest bt-ex5-opening-720p.webm
```

ログイン画面では、パソコンなど大きな画面(長い辺 1100px 以上・短い辺 600px 以上)は 1080p、スマホは 720p を流します(`opening/intro.js`)。もう一度見るときは `/opening/`。

## ロゴ(3D の金のロゴの画像)

- `logo3d.html`: ムービーと同じ形・同じ金の質感のロゴを、背景なし(透明)で描いて PNG にする(`window.exportLogo(1024)`)
- 1024px で書き出し、256px(`assets/bt-ex5-mark-3d.png`)と 512px に縮める。アプリのアイコンはこの画像を暗い背景に重ねて作る

## 前の版

`opening/opening.js` は、前の平面(SVG)の版です(同じ時間割)。
