# BT-EX5 オープニング(やわらかいデザイン・ときめ と つなぐ)の BGM(ここで合成する。16秒)
# 2026年11月14日、運営の依頼で作り直し(2回目)。ピアノだけの、落ち着いたシンプルな曲。ノイズは使わない。
# ニ長調。映像のできごとに合わせる:
#   0.0 白からトキが飛ぶ / 1.2「ときめ」/ 4.0 新幹線が入る / 5.3「つなぐ」/ 9.2「新潟 ⇔ 東京」
#   12.0 輪ができはじめる / 13.3 ロゴ「BT-EX5」が決まる / 14.0 一言 / 16.0 おわり
# 使い方: python3 audio-mascot.py out.wav(numpy が必要)
import numpy as np, wave, sys

SR = 44100
DUR = 16.0
n = int(SR * DUR)
t = np.arange(n) / SR
mix_l = np.zeros(n)
mix_r = np.zeros(n)


def hz(name):
    names = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}
    note, octv = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((names[note] + 12 * (octv + 1) - 69) / 12)


# ピアノの1音: 少しずれた2本の弦、倍音は少し高めにずれる(弦の硬さ)、高い倍音ほど早く消える、2段の減衰。
# length のあとは 0.3 秒で止める(ダンパー)。低い音は左、高い音は右に少し寄せる
def piano(name, start, vel=0.6, length=6.0):
    f0 = hz(name)
    ln = min(length + 0.3, DUR - start)
    if ln <= 0:
        return
    tt = np.arange(int(ln * SR)) / SR
    B = 0.00012 * (f0 / 261.6) ** 0.5
    scale = (f0 / 261.6) ** 0.45  # 高い音ほど早く消える
    s = np.zeros_like(tt)
    for k in range(1, 15):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        if fk > 11000:
            break
        amp = (1 / k ** 1.15) * np.exp(-(k - 1) * (0.55 - 0.3 * vel))
        d1 = (0.9 + 0.32 * k) * scale
        d2 = (0.18 + 0.05 * k) * scale
        env = 0.68 * np.exp(-tt * d1) + 0.32 * np.exp(-tt * d2)
        for det in (-0.0007, 0.0007):
            s += 0.5 * amp * env * np.sin(2 * np.pi * fk * (1 + det) * tt + k * 0.7)
    s *= np.minimum(1, tt / 0.003)  # ハンマーが当たる立ち上がり
    off = int(length * SR)
    if off < len(s):
        r = len(s) - off
        s[off:] *= np.linspace(1, 0, r) ** 2
    s *= vel
    pan = np.clip((np.log2(f0 / 261.6)) * 0.18, -0.35, 0.35)  # -: 左 / +: 右
    i0 = int(start * SR)
    mix_l[i0:i0 + len(s)] += s * (1 - pan)
    mix_r[i0:i0 + len(s)] += s * (1 + pan)


def chord_roll(names, start, step, vel, length):
    for k, nm in enumerate(names):
        piano(nm, start + k * step, vel, length - k * step)


# ---- 0.0〜1.2: はじまり。低いレと、静かな分散和音 ----
piano("D2", 0.1, 0.42, 3.9)
piano("A2", 0.1, 0.30, 3.9)
for k, nm in enumerate(["F#4", "A4", "D5"]):
    piano(nm, 0.35 + k * 0.28, 0.30, 1.6)

# ---- 左手: ゆったりした分散和音(低い音 → 5度 → 10度 → 5度) ----
LH = [
    (1.2, 1.4, ["D3", "A3", "F#4", "A3"]),     # D「ときめ」
    (2.6, 1.4, ["B2", "F#3", "D4", "F#3"]),    # Bm
    (5.3, 1.3, ["A2", "E3", "C#4", "E3"]),     # A「つなぐ」
    (6.6, 1.3, ["F#2", "C#3", "A3", "C#3"]),   # F#m
    (7.9, 1.3, ["B2", "F#3", "D4", "F#3"]),    # Bm
    (9.2, 1.4, ["G2", "D3", "B3", "D3"]),      # G「新潟 ⇔ 東京」
    (10.6, 1.4, ["A2", "E3", "C#4", "E3"]),    # A
]
for st, ln, notes in LH:
    stepw = ln / 4
    for k, nm in enumerate(notes):
        piano(nm, st + k * stepw, 0.36 if k == 0 else 0.24, ln - k * stepw + 0.15)

# ---- 新幹線が入る(4.0): G の和音を下から軽くころがす ----
piano("G2", 4.0, 0.40, 1.3)
for k, nm in enumerate(["D3", "G3", "B3", "D4", "G4", "B4", "D5"]):
    piano(nm, 4.0 + 0.07 * (k + 1), 0.22 + 0.01 * k, 1.25 - 0.07 * k)

# ---- 右手のメロディ ----
MEL = [
    (1.2, "A5", 0.50, 0.6), (1.8, "F#5", 0.42, 0.4), (2.2, "E5", 0.40, 0.4), (2.6, "F#5", 0.46, 1.0), (3.6, "D5", 0.40, 0.4),  # ときめ
    (5.3, "E5", 0.46, 0.45), (5.75, "F#5", 0.44, 0.45), (6.2, "A5", 0.48, 0.4), (6.6, "C#6", 0.46, 0.7),                       # つなぐ
    (7.3, "B5", 0.40, 0.6), (7.9, "A5", 0.44, 0.45), (8.35, "F#5", 0.40, 0.85),
    (9.2, "B5", 0.48, 0.5), (9.7, "A5", 0.42, 0.45), (10.15, "G5", 0.40, 0.45), (10.6, "A5", 0.46, 0.5),                       # 新潟 ⇔ 東京
    (11.1, "B5", 0.44, 0.45), (11.55, "C#6", 0.44, 0.45),
]
for st, nm, vel, ln in MEL:
    piano(nm, st, vel, ln + 0.2)
    if st in (1.2, 5.3, 9.2):  # 文字が出るところは、オクターブ下を重ねて少し太く
        piano(nm[:-1] + str(int(nm[-1]) - 1), st, vel * 0.45, ln + 0.2)

# ---- 輪ができる(12.0〜13.1): だんだん速く上がる分散和音(A)。13.1〜13.3 は一瞬の間 ----
rise = ["A2", "E3", "A3", "C#4", "E4", "A4", "C#5", "E5", "A5", "C#6"]
for k, nm in enumerate(rise):
    st = 12.0 + 1.05 * (1 - (1 - k / len(rise)) ** 1.5)
    piano(nm, st, 0.26 + 0.018 * k, 13.15 - st)

# ---- ロゴが決まる(13.3): 下から一気にころがす D の和音と、高いところの2音 ----
chord_roll(["D1", "D2", "A2", "D3", "F#3", "A3", "D4", "F#4", "A4", "D5"], 13.3, 0.018, 0.5, 2.6)
piano("D6", 13.3, 0.42, 2.6)
piano("A5", 13.85, 0.30, 2.0)
piano("F#5", 14.4, 0.26, 1.5)  # 一言が出るところ
piano("D5", 14.95, 0.22, 1.0)

# ---- 残響: 早い反射をいくつも重ねたなめらかな響き(ノイズは使わない)。小さめのホール ----
rng = np.random.default_rng(11)
ir_len = int(2.2 * SR)
ir = np.zeros(ir_len)
taps = np.sort(rng.uniform(0.010, 2.1, 2600))
amps = np.exp(-taps * 2.8) * rng.choice([-1, 1], len(taps))
ir[(taps * SR).astype(int)] += amps
ir = np.convolve(ir, np.hanning(int(0.005 * SR)), mode="same")
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(n + ir_len)))


def reverb(x):
    r = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[:n]
    # 残響の高い音をやわらげる(周波数の上でゆるやかに落とす)
    R = np.fft.rfft(r)
    f = np.fft.rfftfreq(n, 1 / SR)
    R *= 1 / np.sqrt(1 + (f / 4500) ** 2)
    return np.fft.irfft(R, n)


out_l = mix_l + 0.26 * reverb(mix_l)
out_r = mix_r + 0.26 * reverb(mix_r)

# ---- 仕上げ: 始まりと終わりをやわらかく、前の BGM と同じくらいの大きさに ----
fade = np.clip(t / 0.08, 0, 1) * np.clip((DUR - t) / 1.1, 0, 1)
out_l *= fade
out_r *= fade
st = np.stack([out_l, out_r], axis=1)
st *= 0.085 / max(1e-6, np.sqrt(np.mean(st ** 2)))
peak = np.max(np.abs(st))
if peak > 0.9:
    st = np.tanh(st / peak * 1.4) / np.tanh(1.4) * 0.9
pcm = (np.clip(st, -1, 1) * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1], DUR, "s")
