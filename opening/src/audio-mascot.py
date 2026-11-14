# BT-EX5 オープニング(やわらかいデザイン・ときめ と つなぐ)の BGM(ここで合成する。16秒)
# 2026年11月14日、運営の依頼で作り直し(3回目)。ピアノだけの曲。覚えやすいメロディと I–V–vi–IV の和音で、ロゴに向けて盛り上げる。
# ノイズは使わない。ニ長調・毎分100拍。映像のできごとに合わせる:
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


# ---- 拍と小節: 毎分100拍(1拍 0.6 秒・1小節 4拍 = 2.4 秒)。1小節目の頭を「ときめ」(1.2 秒)にそろえる ----
#   1小節目 1.2 ときめ / 2小節目 3.6(2拍目 4.2 ごろ新幹線)/ 3小節目 6.0(弱起 5.4 から「つなぐ」)
#   4小節目 8.4(2拍目 9.0 で「新潟 ⇔ 東京」)/ 5小節目 10.8(3拍目 12.0 で輪)/ 13.3 ロゴ
BEAT = 0.6
BAR0 = 1.2


def at(bar, beat):
    return BAR0 + (bar - 1) * 4 * BEAT + beat * BEAT


# 和音(小節, 拍, 拍の長さ, 低い音, 分散和音の音)
CH = [
    (1, 0, 2, "D2", ["D3", "A3", "F#4", "A3"]),     # D
    (1, 2, 2, "A1", ["A2", "E3", "C#4", "E3"]),     # A
    (2, 0, 2, "B1", ["B2", "F#3", "D4", "F#3"]),    # Bm
    (2, 2, 2, "G1", ["G2", "D3", "B3", "D3"]),      # G
    (3, 0, 2, "D2", ["D3", "A3", "F#4", "A3"]),     # D
    (3, 2, 2, "C#2", ["A2", "E3", "C#4", "E3"]),    # A/C#
    (4, 0, 2, "G1", ["G2", "D3", "B3", "D4"]),      # G
    (4, 2, 2, "A1", ["A2", "E3", "C#4", "E4"]),     # A
    (5, 0, 2, "E2", ["E3", "B3", "D4", "G4"]),      # Em7
]
for bar, beat, ln, bass, arp in CH:
    st = at(bar, beat)
    loud = 0.30 + 0.025 * (bar - 1)  # だんだん強く
    piano(bass, st, loud + 0.10, ln * BEAT + 0.1)          # 低い音
    piano(bass[:-1] + str(int(bass[-1]) + 1), st, loud, ln * BEAT + 0.1)  # そのオクターブ上
    for k in range(ln * 2):                                 # 8分音符の分散和音
        piano(arp[k % 4], st + k * BEAT / 2, loud * (0.85 if k % 2 == 0 else 0.7), BEAT * 0.9)

# ---- はじまり(0〜1.2): 和音を静かにころがして、2つの音で1小節目へ ----
chord_roll(["D3", "A3", "D4", "F#4", "A4"], 0.05, 0.06, 0.30, 1.1)
piano("A4", 0.6, 0.38, 0.3)
piano("D5", 0.9, 0.42, 0.3)

# ---- メロディ(小節, 拍, 長さの拍, 音, 強さ) ----
MEL = [
    # 1小節目「ときめ」: ファ#ーミファ# ラーミ
    (1, 0, 1, "F#5", 0.56), (1, 1, 0.5, "E5", 0.46), (1, 1.5, 0.5, "F#5", 0.48), (1, 2, 1, "A5", 0.56), (1, 3, 1, "E5", 0.46),
    # 2小節目: レーード# シーレ
    (2, 0, 1.5, "D5", 0.50), (2, 1.5, 0.5, "C#5", 0.42), (2, 2, 1, "B4", 0.46), (2, 3, 0.5, "A4", 0.40), (2, 3.5, 0.5, "D5", 0.48),
    # 3小節目「つなぐ」: 1小節目のくり返しで、上へ(ファ#ーミファ# ラード#)
    (3, 0, 1, "F#5", 0.58), (3, 1, 0.5, "E5", 0.48), (3, 1.5, 0.5, "F#5", 0.50), (3, 2, 1, "A5", 0.58), (3, 3, 1, "C#6", 0.56),
    # 4小節目「新潟 ⇔ 東京」: レーシ ド#ーミ
    (4, 0, 1, "D6", 0.62), (4, 1, 1, "B5", 0.54), (4, 2, 1, "C#6", 0.58), (4, 3, 1, "E6", 0.60),
    # 5小節目: レーシラ(輪ができるところへ)
    (5, 0, 1, "D6", 0.60), (5, 1, 0.5, "B5", 0.50), (5, 1.5, 0.5, "A5", 0.50),
]
for bar, beat, ln, nm, vel in MEL:
    st = at(bar, beat)
    piano(nm, st, vel, ln * BEAT + 0.12)
    if beat == 0 or (bar == 4 and beat == 1):  # 小節の頭(と「新潟 ⇔ 東京」)はオクターブ下を重ねて太く
        piano(nm[:-1] + str(int(nm[-1]) - 1), st, vel * 0.5, ln * BEAT + 0.12)
# 「つなぐ」の弱起(5.4): ラ・レで3小節目へ
piano("A4", 5.4, 0.42, 0.3)
piano("D5", 5.7, 0.46, 0.3)
# 新幹線が入る(4.2 ごろ): 高いところで小さく「ころん」
for k, nm in enumerate(["B5", "D6", "F#6"]):
    piano(nm, 4.2 + 0.08 * k, 0.24, 0.5)

# ---- 輪ができる(12.0〜13.1): A の和音で、だんだん速く上がる。左手は A のオクターブを刻む ----
for k in range(4):
    st = 12.0 + k * 0.28
    piano("A1", st, 0.40 + 0.04 * k, 0.26)
    piano("A2", st, 0.34 + 0.04 * k, 0.26)
rise = ["A3", "C#4", "E4", "G4", "A4", "C#5", "E5", "G5", "A5", "C#6", "E6", "A6"]
for k, nm in enumerate(rise):
    st = 12.0 + 1.05 * (1 - (1 - k / len(rise)) ** 1.5)
    piano(nm, st, 0.30 + 0.022 * k, 13.12 - st)

# ---- ロゴが決まる(13.3): 下から一気にころがす D の和音と、メロディの最後(レ・ラ・ファ#・レ) ----
chord_roll(["D1", "D2", "A2", "D3", "F#3", "A3", "D4", "F#4", "A4"], 13.3, 0.016, 0.62, 2.6)
piano("D6", 13.3, 0.66, 1.2)
piano("D5", 13.3, 0.40, 1.2)
piano("A5", 14.5, 0.46, 0.6)   # 一言が出るところ
piano("F#5", 15.1, 0.40, 0.8)
piano("D5", 15.1, 0.26, 0.8)
piano("A3", 14.5, 0.28, 1.4)
piano("F#4", 14.5, 0.24, 1.4)

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
