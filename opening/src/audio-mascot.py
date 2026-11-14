# BT-EX5 オープニング(やわらかいデザイン・ときめ と つなぐ)の BGM(16秒)
# 2026年11月14日、運営の依頼で作り直し(4回目)。合成音ではなく、本物の楽器を録音した音源(FluidR3_GM・MIT ライセンス)で鳴らす。
# 調べた定番の作り方に合わせた:
#   ・和音は J-POP・アニメでいちばん使われる「王道進行」(IV△7–V7–iii7–vi)。最後は IV–V–I でロゴに落ち着く
#   ・静かに始めて、だんだん盛り上げる(ストリングスが中心のオーケストラ)。ロゴの前で少しためる
#   ・くり返しのある、覚えやすいメロディ
#   ・ザーッと聞こえるシンバルなどは使わない
# ニ長調・毎分100拍(1拍 0.6 秒・1小節 2.4 秒)。映像のできごとに合わせる:
#   0.0 白からトキが飛ぶ / 1.2「ときめ」(1小節目)/ 4.05 ごろ新幹線(琴が駆け上がる)/ 5.4 弱起から「つなぐ」(3小節目)
#   9.0「新潟 ⇔ 東京」(4小節目2拍目)/ 12.0 輪ができる(ティンパニとハープ)/ 13.3 ロゴ「BT-EX5」/ 16.0 おわり
# 使い方: python3 audio-mascot.py out.wav
#   必要なもの: numpy・mido(pip)、fluidsynth と FluidR3_GM.sf2(apt の fluidsynth・fluid-soundfont-gm)
import subprocess, sys, os, wave
import numpy as np
import mido

SF2 = "/usr/share/sounds/sf2/FluidR3_GM.sf2"
OUT = sys.argv[1]
MID = OUT + ".mid"
TPB = 480                       # 1拍の細かさ
BPM = 100
SEC = 60 / BPM                  # 1拍 0.6 秒
DUR = 16.0

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def nn(name):
    return NOTE[name[:-1]] + 12 * (int(name[-1]) + 1)


# 楽器ごとのできごと: (秒, 種類, ...)。最後に MIDI の時間に直す
tracks = {}


def track(name, ch, program, vol=100, pan=64, rev=60, cho=10):
    tracks[name] = {"ch": ch, "ev": [], "setup": [("program_change", program), ("cc", 7, vol), ("cc", 10, pan), ("cc", 91, rev), ("cc", 93, cho), ("cc", 11, 127)]}


def note(name, nm, start, length, vel):
    tracks[name]["ev"].append((start, "on", nn(nm), vel))
    tracks[name]["ev"].append((start + length, "off", nn(nm), 0))


def expr(name, start, end, v0, v1, steps=24):  # 音の大きさ(CC11)をなめらかに変える
    for k in range(steps + 1):
        tt = start + (end - start) * k / steps
        tracks[name]["ev"].append((tt, "cc", 11, int(v0 + (v1 - v0) * k / steps)))


BAR0 = 1.2


def at(bar, beat=0.0):
    return BAR0 + (bar - 1) * 4 * SEC + beat * SEC


track("strings", 0, 48, vol=100, pan=64, rev=80, cho=20)    # ストリングス
track("violin", 1, 40, vol=88, pan=80, rev=70)              # バイオリン(メロディを重ねる)
track("flute", 2, 73, vol=100, pan=56, rev=70)              # 笛(メロディ)
track("piano", 3, 0, vol=86, pan=60, rev=60)                # ピアノ(分散和音)
track("cello", 4, 42, vol=96, pan=50, rev=60)               # チェロ(低い音)
track("pizz", 5, 45, vol=80, pan=72, rev=50)                # ピチカート(刻み)
track("koto", 6, 107, vol=96, pan=40, rev=70)               # 琴
track("glock", 7, 9, vol=70, pan=88, rev=90)                # 鉄琴(きらめき)
track("horn", 8, 60, vol=84, pan=44, rev=80)                # ホルン
track("timp", 10, 47, vol=100, pan=64, rev=60)              # ティンパニ(ch 9 は打楽器専用なので 10)
track("harp", 11, 46, vol=86, pan=76, rev=80)               # ハープ

# ---- 和音(王道進行 × 2 → Em7 → A7sus4 → A7 → D) ----
CH = [
    (at(1, 0), 2, "G2", ["D3", "F#3", "B3", "D4"], ["G3", "B3", "D4", "F#4"]),    # G△7
    (at(1, 2), 2, "A2", ["E3", "G3", "C#4", "E4"], ["A3", "C#4", "E4", "G4"]),    # A7
    (at(2, 0), 2, "F#2", ["C#3", "E3", "A3", "C#4"], ["F#3", "A3", "C#4", "E4"]),  # F#m7
    (at(2, 2), 2, "B1", ["F#3", "A3", "D4", "F#4"], ["B3", "D4", "F#4", "A4"]),   # Bm7
    (at(3, 0), 2, "G2", ["D3", "F#3", "B3", "D4"], ["G3", "B3", "D4", "F#4"]),    # G△7
    (at(3, 2), 2, "A2", ["E3", "G3", "C#4", "E4"], ["A3", "C#4", "E4", "G4"]),    # A7
    (at(4, 0), 2, "F#2", ["C#3", "E3", "A3", "C#4"], ["F#3", "A3", "C#4", "E4"]),  # F#m7
    (at(4, 2), 2, "B1", ["F#3", "A3", "D4", "F#4"], ["B3", "D4", "F#4", "A4"]),   # Bm7
    (at(5, 0), 2, "E2", ["D3", "G3", "B3", "E4"], ["E3", "G3", "B3", "D4"]),      # Em7
    (at(5, 2), 1, "A1", ["D3", "E3", "A3", "D4"], ["A3", "D4", "E4", "A4"]),      # A7sus4(輪ができる)
    (at(5, 3), 1.5, "A1", ["C#3", "E3", "G3", "C#4"], ["A3", "C#4", "E4", "G4"]),  # A7(少しためて 13.3 へ)
]
for st, beats, bass, strings, arp in CH:
    ln = beats * SEC
    bar = int((st - BAR0) // (4 * SEC)) + 1
    for nm in strings:
        note("strings", nm, st, ln + 0.05, 64 + 6 * bar)
    note("cello", bass, st, ln, 70 + 6 * bar)
    # ピアノの8分音符の分散和音(1・2小節目はやさしく)
    for k in range(int(beats * 2)):
        note("piano", arp[k % 4], st + k * SEC / 2, SEC / 2 * 1.6, 44 + 6 * bar if k % 2 == 0 else 36 + 5 * bar)
    # 3小節目から、ピチカートで低い音を刻む
    if bar >= 3:
        for k in range(int(beats * 2)):
            note("pizz", bass[:-1] + str(int(bass[-1]) + 1), st + k * SEC / 2, SEC / 2 * 0.8, 70 + 8 * (bar - 3))

# 全体の大きさ: 静かに始めて、だんだん強く(ストリングス)
expr("strings", 0.0, 1.2, 40, 85)
expr("strings", 1.2, 8.4, 85, 100)
expr("strings", 8.4, 13.2, 100, 127)

# ---- はじまり(0〜1.2): ストリングスの D の和音がふくらみ、鉄琴と琴で1小節目へ ----
for nm in ["D3", "A3", "D4", "F#4", "A4"]:
    note("strings", nm, 0.05, 1.2, 60)
note("cello", "D2", 0.05, 1.2, 60)
note("glock", "A5", 0.15, 0.8, 70)
note("glock", "D6", 0.45, 0.8, 60)
for k, nm in enumerate(["D4", "E4", "F#4", "A4", "B4", "D5"]):   # 琴の駆け上がり(陽音階)
    note("koto", nm, 0.75 + k * 0.07, 0.5, 70 + 4 * k)

# ---- メロディ(小節, 拍, 長さの拍, 音, 強さ) ----
MEL = [
    # 1・2小節目「ときめ」: 笛
    (1, 0, 1, "F#5", 92), (1, 1, 0.5, "A5", 84), (1, 1.5, 0.5, "B5", 86), (1, 2, 1.5, "A5", 92), (1, 3.5, 0.5, "E5", 80),
    (2, 0, 1, "F#5", 90), (2, 1, 0.5, "E5", 80), (2, 1.5, 0.5, "D5", 80), (2, 2, 1, "E5", 86),
    (2, 3, 0.5, "A4", 78), (2, 3.5, 0.5, "D5", 84),                 # 「つなぐ」へ向かう弱起
    # 3・4小節目「つなぐ」〜「新潟 ⇔ 東京」: 笛とバイオリンで、1回目より上へ
    (3, 0, 1, "F#5", 98), (3, 1, 0.5, "A5", 90), (3, 1.5, 0.5, "B5", 92), (3, 2, 1, "C#6", 100), (3, 3, 0.5, "B5", 88), (3, 3.5, 0.5, "A5", 88),
    (4, 0, 1, "A5", 100), (4, 1, 1, "C#6", 108), (4, 2, 1, "D6", 108), (4, 3, 1, "E6", 112),
    # 5小節目: いちばん高いところから、輪ができるところへ
    (5, 0, 1.5, "F#6", 118), (5, 1.5, 0.5, "E6", 104), (5, 2, 1, "D6", 108), (5, 3, 1.5, "C#6", 112),
]
for bar, beat, ln, nm, vel in MEL:
    st = at(bar, beat)
    note("flute", nm, st, ln * SEC * 0.95, vel)
    if bar >= 3:
        note("violin", nm, st, ln * SEC * 0.98, max(40, vel - 14))

# 文字が出るところで鉄琴
for st, nm in [(1.2, "A6"), (1.2, "F#6"), (at(3, 0), "A6"), (at(3, 0), "D7"), (9.0, "C#7"), (9.0, "A6")]:
    note("glock", nm, st, 0.6, 72)

# 新幹線が入る(4.05 ごろ): ザーッの代わりに、琴が下から駆け上がる
for k, nm in enumerate(["F#3", "A3", "B3", "D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5"]):
    note("koto", nm, 4.05 + k * 0.045, 0.6, 72 + 3 * k)

# ホルン: 4小節目から和音を支える
for st, ln, notes in [(at(4, 0), 2 * SEC, ["F#3", "C#4"]), (at(4, 2), 2 * SEC, ["F#3", "D4"]), (at(5, 0), 2 * SEC, ["G3", "D4"]),
                      (at(5, 2), 1 * SEC, ["A3", "D4"]), (at(5, 3), 1.5 * SEC, ["A3", "C#4"])]:
    for nm in notes:
        note("horn", nm, st, ln, 82)

# ---- 輪ができる(12.0〜13.2): ティンパニのロールと、ハープの駆け上がり ----
tt = 12.0
while tt < 13.15:
    note("timp", "A2", tt, 0.06, min(120, 54 + int((tt - 12.0) * 55)))
    tt += 0.075
for k, nm in enumerate(["A3", "C#4", "E4", "G4", "A4", "C#5", "E5", "G5", "A5", "C#6", "E6", "G6", "A6"]):
    note("harp", nm, 12.4 + k * 0.06, 1.0, 74 + 3 * k)

# ---- ロゴが決まる(13.3): IV–V–I の I(D)。みんなで一緒に鳴らす ----
HIT = 13.3
note("timp", "D2", HIT, 1.5, 124)
note("timp", "A2", HIT + 0.02, 1.2, 100)
for nm in ["D2", "D3"]:
    note("cello", nm, HIT, 2.5, 110)
for nm in ["D3", "A3", "D4", "F#4", "A4", "D5"]:
    note("strings", nm, HIT, 2.6, 112)
for nm in ["D3", "A3", "F#4", "D4"]:
    note("horn", nm, HIT, 2.0, 100)
for nm in ["D2", "A2", "D3", "F#3", "A3", "D4", "F#4", "A4", "D5"]:
    note("piano", nm, HIT, 2.4, 92)
note("flute", "D6", HIT, 2.2, 112)
note("violin", "D6", HIT, 2.3, 100)
for st, nm in [(HIT, "D7"), (HIT + 0.3, "A6"), (HIT + 0.6, "F#6"), (14.4, "A6"), (14.7, "D7")]:
    note("glock", nm, st, 0.8, 70)
note("koto", "A4", 14.4, 1.0, 76)   # 一言が出るところで、琴の2音
note("koto", "D5", 14.6, 1.2, 80)
expr("strings", HIT + 0.3, 15.9, 127, 70)

# ---- MIDI に書き出す(テンポは 100 で一定。秒をそのまま拍に直す) ----
mf = mido.MidiFile(ticks_per_beat=TPB)
meta = mido.MidiTrack()
meta.append(mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(BPM), time=0))
mf.tracks.append(meta)
for name, tr in tracks.items():
    mt = mido.MidiTrack()
    ch = tr["ch"]
    for s in tr["setup"]:
        if s[0] == "program_change":
            mt.append(mido.Message("program_change", channel=ch, program=s[1], time=0))
        else:
            mt.append(mido.Message("control_change", channel=ch, control=s[1], value=s[2], time=0))
    order = {"off": 0, "cc": 1, "on": 2}
    evs = sorted(tr["ev"], key=lambda e: (e[0], order[e[1]]))
    last = 0
    for e in evs:
        tick = int(round(e[0] / SEC * TPB))
        dt = max(0, tick - last)
        last = max(last, tick)
        if e[1] == "on":
            mt.append(mido.Message("note_on", channel=ch, note=e[2], velocity=max(1, min(127, e[3])), time=dt))
        elif e[1] == "off":
            mt.append(mido.Message("note_off", channel=ch, note=e[2], velocity=0, time=dt))
        else:
            mt.append(mido.Message("control_change", channel=ch, control=e[2], value=max(0, min(127, e[3])), time=dt))
    mf.tracks.append(mt)
mf.save(MID)

# ---- 音にする(fluidsynth。残響とコーラスはやわらかめ) ----
raw = OUT + ".raw.wav"
subprocess.run(["fluidsynth", "-ni", "-q", "-g", "0.6", "-r", "44100",
                "-o", "synth.reverb.room-size=0.62", "-o", "synth.reverb.width=0.9", "-o", "synth.reverb.level=0.55",
                "-o", "synth.chorus.level=0.6",
                "-F", raw, SF2, MID], check=True)

# ---- 仕上げ: 16 秒にそろえ、始まりと終わりをやわらかく、前の BGM と同じくらいの大きさに ----
with wave.open(raw) as w:
    sr = w.getframerate()
    ch = w.getnchannels()
    x = np.frombuffer(w.readframes(w.getnframes()), "<i2").reshape(-1, ch).astype(np.float64) / 32768
n = int(DUR * sr)
if len(x) < n:
    x = np.vstack([x, np.zeros((n - len(x), ch))])
x = x[:n]
t = np.arange(n) / sr
x *= (np.clip(t / 0.05, 0, 1) * np.clip((DUR - t) / 1.2, 0, 1))[:, None]
x *= 0.085 / max(1e-6, np.sqrt(np.mean(x ** 2)))
peak = np.max(np.abs(x))
if peak > 0.92:
    x = np.tanh(x / peak * 1.5) / np.tanh(1.5) * 0.92
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes((np.clip(x, -1, 1) * 32767).astype("<i2").tobytes())
os.remove(raw)
os.remove(MID)
print("wrote", OUT, DUR, "s")
