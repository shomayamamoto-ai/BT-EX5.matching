# オープニングムービーの作り方

`assets/opening/bt-ex5-opening.mp4`(と 720p 版)は、次の手順で作っています。

- 映像: `opening/opening.js` の `render(t)` が時刻 t(秒)の画面を作る。1920×1080 のページで t を 1/30 秒ずつ進めてスクリーンショットを撮り、30fps の連番画像にする(Playwright)
- 音: `opening/src/audio.py` で合成(5円玉の音、陽音階の鐘、背景の和音)。`python audio.py opening.wav`(numpy が必要)
- 書き出し: `ffmpeg -framerate 30 -i f%04d.png -i opening.wav -c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac -shortest bt-ex5-opening.mp4`
- 字幕・ロゴの文字は Shippori Mincho(明朝)と Inter

ログイン画面では、この端末で初めて開いたときに 720p 版を1回だけ流します(`opening/intro.js`)。もう一度見るときは `/opening/`。
