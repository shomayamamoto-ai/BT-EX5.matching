# BT-EX5 オープニングの音(ここで合成する)
import numpy as np, wave, sys
SR = 44100
DUR = 12.0
n = int(SR * DUR)
t = np.arange(n) / SR
out = np.zeros(n)

def env_exp(start, decay, length=None):
    e = np.zeros(n)
    i0 = int(start * SR)
    i1 = n if length is None else min(n, i0 + int(length * SR))
    tt = np.arange(i1 - i0) / SR
    e[i0:i1] = np.exp(-tt * decay)
    return e

def bell(freq, start, gain, decay=2.2):
    e = env_exp(start, decay, 6)
    att = np.clip((t - start) / 0.004, 0, 1)
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-np.clip(t - start, 0, None) * 3) + 0.15 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-np.clip(t - start, 0, None) * 6)
    return gain * tone * e * att

# 1) 背景の和音(D の陽音階: D E G A B)。ゆっくり立ち上がり、最後に消える
pad_notes = [146.83, 220.0, 293.66, 329.63]
pad = sum(np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.2 * t + k)) for k, f in enumerate(pad_notes))
pad_env = np.clip(t / 3.0, 0, 1) * np.clip((DUR - t) / 2.5, 0, 1)
out += 0.035 * pad * pad_env

# 2) 最初の光がともる音(0.35s)
out += bell(587.33, 0.35, 0.10, decay=1.2)
out += bell(880.0, 0.38, 0.04, decay=1.6)

# 3) 光が5つに分かれる「ふわっ」(1.9〜2.7)— 高い音がゆっくり立ち上がる
rise = sum(np.sin(2 * np.pi * f * t) for f in [1174.7, 1568.0])
rise_env = np.clip((t - 1.9) / 0.6, 0, 1) * np.clip((2.8 - t) / 0.3, 0, 1)
out += 0.015 * rise * rise_env

# 4) 5つの光が着く音(陽音階 D5 E5 G5 A5 B5、着く時刻に合わせる)
for st, f in zip([2.6, 2.75, 2.9, 3.05, 3.2], [587.33, 659.25, 783.99, 880.0, 987.77]):
    out += bell(f, st, 0.16)

# 5) 糸を結ぶきらめき(3.2〜4.6)
shim = sum(np.sin(2 * np.pi * f * t) for f in [1760, 2349, 2637])
shim_env = np.clip((t - 3.2) / 0.4, 0, 1) * np.clip((4.8 - t) / 0.6, 0, 1) * (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t))
out += 0.012 * shim * shim_env

# 6) 光が巡るあいだの軽い鈴(4.6〜7.0、5回)
for k, st in enumerate(np.linspace(4.6, 7.0, 5)):
    out += bell([1174.7, 1318.5, 1568.0, 1760.0, 1975.5][k], st, 0.06, decay=4)

# 7) ロゴの和音(8.2)— D メジャーの鐘と、低い音
for f, g in [(146.83, 0.12), (293.66, 0.14), (440.0, 0.11), (587.33, 0.09), (739.99, 0.07), (880.0, 0.05)]:
    out += bell(f, 8.2, g, decay=0.55)

# 仕上げ: やわらかく音量をそろえる
out = np.tanh(out * 1.4) / np.tanh(1.4)
out *= 0.9 / max(1e-6, np.max(np.abs(out)))
fade = np.clip((DUR - t) / 0.8, 0, 1)
out *= fade
stereo = np.stack([out, np.roll(out, 220) * 0.96], axis=1)
pcm = (stereo * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', sys.argv[1], len(pcm) / SR, 's')
