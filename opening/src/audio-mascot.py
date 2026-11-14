# BT-EX5 オープニング(やわらかいデザイン・ときめ と つなぐ)の BGM(ここで合成する。16秒)
# 2026年11月14日、運営の依頼で作り直し。ノイズ(ザーッ・シュワー)は使わず、音程のある音だけで作る。
# ニ長調(レ・ミ・ファ#・ラ・シの陽音階)。映像のできごとに合わせる:
#   0.0 白からトキが飛ぶ / 1.2「ときめ」/ 4.0 新幹線が入る / 5.3「つなぐ」/ 9.2「新潟 ⇔ 東京」
#   12.0 輪ができはじめる / 13.3 ロゴ「BT-EX5」が決まる / 14.0 一言 / 16.0 おわり
# 使い方: python3 audio-mascot.py out.wav(numpy が必要)
import numpy as np, wave, sys

SR = 44100
DUR = 16.0
n = int(SR * DUR)
t = np.arange(n) / SR
dry = np.zeros(n)
wet = np.zeros(n)  # 残響に送る音


def hz(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    note, octv = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[note] + 12 * (octv + 1) - 69) / 12)


def place(sig, start, gain, send):
    i0 = int(start * SR)
    if i0 >= n:
        return
    sig = sig[: n - i0]
    dry[i0:i0 + len(sig)] += sig * gain
    wet[i0:i0 + len(sig)] += sig * gain * send


def env_adsr(length, a, r):
    m = int(length * SR)
    e = np.ones(m)
    ai, ri = max(1, int(a * SR)), max(1, int(r * SR))
    e[:ai] = np.linspace(0, 1, ai) ** 1.5
    e[-ri:] *= np.linspace(1, 0, ri) ** 1.5
    return e


# やわらかい持続音(パッド): 少しずらした3つの正弦波と、弱い倍音
def pad(freq, start, length, gain):
    tt = np.arange(int(length * SR)) / SR
    s = np.zeros_like(tt)
    for cents in (-4, 0, 4):
        f = freq * 2 ** (cents / 1200)
        s += np.sin(2 * np.pi * f * tt) + 0.22 * np.sin(2 * np.pi * 2 * f * tt) + 0.06 * np.sin(2 * np.pi * 3 * f * tt)
    s *= env_adsr(length, min(0.8, length * 0.4), min(1.0, length * 0.45)) / 3
    place(s, start, gain, 0.9)


# はじく音(ハープ): 高い倍音ほど早く消える
def harp(freq, start, gain, decay=2.2, send=0.7):
    length = 3.0
    tt = np.arange(int(length * SR)) / SR
    s = np.zeros_like(tt)
    for k in range(1, 7):
        s += np.sin(2 * np.pi * freq * k * tt) / k ** 1.3 * np.exp(-tt * decay * (1 + 0.55 * (k - 1)))
    s *= np.minimum(1, tt / 0.004)
    place(s, start, gain, send)


# 鐘(きらめき): 整数でない倍音
def bell(freq, start, gain, decay=1.6, send=1.2):
    length = 4.0
    tt = np.arange(int(length * SR)) / SR
    s = np.zeros_like(tt)
    for ratio, amp, d in ((1.0, 1.0, 1.0), (2.0, 0.45, 1.6), (2.76, 0.28, 2.2), (5.40, 0.12, 3.0)):
        s += amp * np.sin(2 * np.pi * freq * ratio * tt) * np.exp(-tt * decay * d)
    s *= np.minimum(1, tt / 0.003)
    place(s, start, gain, send)


# 笛(メロディ): 正弦波 + 少しの倍音、のびたところでゆれ(ビブラート)
def flute(freq, start, length, gain):
    tt = np.arange(int((length + 0.25) * SR)) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt) * np.clip((tt - 0.25) / 0.3, 0, 1)
    ph = 2 * np.pi * np.cumsum(freq * vib) / SR
    s = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    s *= env_adsr(length + 0.25, 0.07, 0.3)
    place(s, start, gain, 0.8)


# 低い響き(ロゴが決まる): 下がっていく正弦波。ノイズは入れない
def boom(start, gain):
    length = 3.5
    tt = np.arange(int(length * SR)) / SR
    f = 44 + 36 * np.exp(-tt * 7)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.4) * np.minimum(1, tt / 0.008)
    place(s, start, gain, 0.15)


# ---- 和音の流れ ----
CHORDS = [
    (0.0, 2.1, ["D3", "A3", "F#4", "E5"]),       # D(add9) トキが飛ぶ
    (2.1, 1.9, ["B2", "F#3", "D4", "A4"]),       # Bm7
    (4.0, 1.3, ["G2", "D3", "B3", "F#4"]),       # Gmaj7 新幹線が入る
    (5.3, 1.3, ["A2", "E3", "C#4", "E4"]),       # A「つなぐ」
    (6.6, 1.3, ["F#2", "C#3", "A3", "E4"]),      # F#m7
    (7.9, 1.3, ["B2", "F#3", "D4", "A4"]),       # Bm7
    (9.2, 1.4, ["G2", "D3", "B3", "F#4"]),       # Gmaj7「新潟 ⇔ 東京」
    (10.6, 1.4, ["A2", "E3", "D4", "E4"]),       # Asus4
    (12.0, 1.15, ["A2", "E3", "C#4", "G4"]),     # A7 輪ができる(13.15 で一度だけ息をつく)
    (13.3, 2.7, ["D2", "A2", "F#3", "D4", "A4"]),  # D ロゴが決まる
]
for st, ln, notes in CHORDS:
    for k, nm in enumerate(notes):
        pad(hz(nm), st, ln + 0.35, 0.050 if k else 0.065)

# ---- ハープの分散和音(0.25秒ごと)。メロディのあいだは少し小さく ----
ARP = {0.0: ["D4", "A4", "F#4", "A4"], 2.1: ["B3", "F#4", "D4", "F#4"], 4.0: ["G3", "D4", "B3", "D4"],
       5.3: ["A3", "E4", "C#4", "E4"], 6.6: ["F#3", "C#4", "A3", "C#4"], 7.9: ["B3", "F#4", "D4", "F#4"],
       9.2: ["G3", "D4", "B3", "D4"], 10.6: ["A3", "E4", "D4", "E4"]}
keys = sorted(ARP)
for x in np.arange(0.5, 12.0, 0.25):
    base = max(k for k in keys if k <= x + 1e-6)
    pat = ARP[base]
    i = int(round((x - 0.5) / 0.25))
    g = 0.11 if (1.2 <= x < 3.9 or 5.3 <= x < 12.0) else 0.15
    if 3.9 <= x < 4.6:
        continue  # 新幹線のところは、下の上がっていくハープにまかせる
    harp(hz(pat[i % 4]), x, g, decay=2.6, send=0.6)

# ---- 新幹線が入る(4.0): ザーッの代わりに、上がっていくハープ(ニ長調の陽音階) ----
gl = ["D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5", "A5", "B5", "D6"]
for k, nm in enumerate(gl):
    harp(hz(nm), 3.95 + k * 0.055, 0.10 + 0.006 * k, decay=2.0, send=0.9)

# ---- メロディ(笛) ----
MEL = [
    (1.2, "F#5", 0.55), (1.75, "A5", 0.55), (2.3, "B5", 0.4), (2.7, "A5", 1.1),             # ときめ
    (5.3, "D5", 0.45), (5.75, "E5", 0.45), (6.2, "F#5", 0.55), (6.75, "A5", 1.0),            # つなぐ
    (7.9, "F#5", 0.45), (8.35, "E5", 0.75),
    (9.2, "D5", 0.38), (9.58, "E5", 0.38), (9.96, "F#5", 0.38), (10.34, "A5", 0.6),           # 新潟 ⇔ 東京
    (10.95, "B5", 0.5), (11.45, "A5", 0.5),
    (13.3, "D6", 2.2),                                                                        # ロゴ
]
for st, nm, ln in MEL:
    flute(hz(nm), st, ln, 0.085)

# ---- 文字が出るときのきらめき ----
for st, nm, g in [(0.15, "A6", 0.035), (1.2, "A6", 0.05), (1.32, "D7", 0.03), (5.3, "D6", 0.05), (5.42, "F#6", 0.03),
                  (9.2, "F#6", 0.05), (9.32, "A6", 0.03), (14.0, "A6", 0.035), (14.12, "D7", 0.025)]:
    bell(hz(nm), st, g)

# ---- 輪ができる(12.0〜13.15): だんだん速く上がるハープ。13.15〜13.3 は一瞬の間 ----
rise = ["A3", "B3", "D4", "E4", "F#4", "A4", "B4", "D5", "E5", "F#5", "A5", "B5", "D6", "E6", "F#6", "A6"]
tt0 = 12.0
for k, nm in enumerate(rise):
    st = tt0 + 1.1 * (1 - (1 - k / len(rise)) ** 1.6)
    harp(hz(nm), st, 0.07 + 0.004 * k, decay=3.2, send=1.0)

# ---- ロゴが決まる(13.3) ----
boom(13.3, 0.55)
harp(hz("D2"), 13.3, 0.22, decay=0.9, send=0.3)
for nm, g in [("D4", 0.10), ("F#4", 0.08), ("A4", 0.08), ("D5", 0.07), ("A5", 0.05)]:
    bell(hz(nm), 13.3, g, decay=0.7, send=1.0)
for st, nm in [(13.38, "D7"), (13.62, "A6"), (13.9, "F#6")]:
    bell(hz(nm), st, 0.022, decay=1.4)

# ---- 残響: 早い反射をいくつも重ねた、なめらかな響き(ノイズは使わない) ----
rng = np.random.default_rng(7)
ir_len = int(2.6 * SR)
ir = np.zeros(ir_len)
taps = np.sort(rng.uniform(0.012, 2.5, 2400))
amps = np.exp(-taps * 2.4) * rng.choice([-1, 1], len(taps))
ir[(taps * SR).astype(int)] += amps
ir = np.convolve(ir, np.hanning(int(0.004 * SR)), mode="same")  # 角をとってやわらかく
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(n + ir_len)))
rev = np.fft.irfft(np.fft.rfft(wet, size) * np.fft.rfft(ir, size), size)[:n]
# 残響の高い音を少し落とす(1次のローパス)
a = 0.35
rev_lp = np.empty_like(rev)
acc = 0.0
for i in range(0, n, 4096):
    blk = rev[i:i + 4096]
    out = np.empty_like(blk)
    for j, v in enumerate(blk):
        acc += a * (v - acc)
        out[j] = acc
    rev_lp[i:i + 4096] = out
mix = dry + 0.32 * rev_lp

# ---- 仕上げ: 始まりと終わりをやわらかく、音量をそろえる ----
mix *= np.clip(t / 0.25, 0, 1)
mix *= np.clip((DUR - t) / 1.0, 0, 1)
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
mix *= 0.72 / max(1e-6, np.max(np.abs(mix)))  # 前の BGM と同じくらいの大きさ
stereo = np.stack([mix, np.roll(mix, 220) * 0.97], axis=1)
pcm = (stereo * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1], DUR, "s")
