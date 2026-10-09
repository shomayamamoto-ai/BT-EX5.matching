# BT-EX5 オープニングの音(ここで合成する。13秒)
# 低い持続音 → 光がともる鐘 → 糸のきらめき → 光が巡る音 → 上がっていく音(ライザー)→
# 一瞬の無音 → ロゴが決まる瞬間(9.0秒)に低い響きと和音、長い残響
import numpy as np, wave, sys

SR = 44100
DUR = 13.0
HIT = 9.0
n = int(SR * DUR)
t = np.arange(n) / SR
dry = np.zeros(n)
wet_send = np.zeros(n)  # 残響に送る音

def at(sec):
    return int(sec * SR)

def env_exp(start, decay, length=6.0):
    e = np.zeros(n)
    i0 = at(start)
    i1 = min(n, i0 + at(length))
    tt = np.arange(i1 - i0) / SR
    e[i0:i1] = np.exp(-tt * decay)
    return e

def bell(freq, start, gain, decay=2.0):
    # 鐘・ピアノに近い音(倍音を少し入れ、立ち上がりはやわらかく)
    e = env_exp(start, decay)
    att = np.clip((t - start) / 0.008, 0, 1)
    k = np.clip(t - start, 0, None)
    tone = (np.sin(2 * np.pi * freq * t)
            + 0.30 * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-k * 2.5)
            + 0.12 * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-k * 5))
    return gain * tone * e * att

def lowpass(x, a):
    # 一次のローパス(a は 0〜1、小さいほどこもる。配列も可)
    y = np.zeros_like(x)
    acc = 0.0
    aa = np.broadcast_to(a, x.shape)
    for i in range(len(x)):
        acc += aa[i] * (x[i] - acc)
        y[i] = acc
    return y

rng = np.random.default_rng(13)

# 1) 低い持続音(A)。ゆっくり立ち上がり、ロゴの直前(8.85〜9.0)で一度引く
drone = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.41 * t + 0.4)
         + 0.35 * np.sin(2 * np.pi * 110 * t + 1.1) + 0.15 * np.sin(2 * np.pi * 164.8 * t))
drone *= 1 + 0.15 * np.sin(2 * np.pi * 0.11 * t)
drone_env = np.clip(t / 4.0, 0, 1) ** 1.5 * np.clip((8.85 - t) / 0.15, 0, 1)
dry += 0.05 * drone * drone_env
# ロゴのあとは、和音の下で静かに続く
dry += 0.03 * drone * np.clip((t - HIT) / 1.5, 0, 1) * np.clip((DUR - t) / 1.2, 0, 1)

# 2) ひとつの光がともる(0.6秒)
x = bell(587.33, 0.6, 0.10, decay=1.0) + bell(880.0, 0.62, 0.04, decay=1.3)
dry += x; wet_send += x * 1.2

# 3) 5つの光が頂点に着く音(D の陽音階 D E F# A B)
for k, f in enumerate([587.33, 659.25, 739.99, 880.0, 987.77]):
    x = bell(f, 3.9 + k * 0.12, 0.09, decay=2.2)
    dry += x; wet_send += x

# 4) 金の糸を結ぶきらめき(4.4〜5.8)
shim = sum(np.sin(2 * np.pi * f * t) for f in [1760.0, 2217.5, 2637.0])
shim_env = np.clip((t - 4.4) / 0.4, 0, 1) * np.clip((6.0 - t) / 0.6, 0, 1) * (0.5 + 0.5 * np.sin(2 * np.pi * 7 * t))
x = 0.008 * shim * shim_env
dry += x; wet_send += x * 2

# 5) 光が巡るあいだのやわらかな音(5.9〜8.0)
for k, st in enumerate(np.arange(5.9, 8.0, 0.42)):
    x = bell([1174.7, 1318.5, 1480.0, 1760.0, 1975.5][k % 5], st, 0.035, decay=4)
    dry += x; wet_send += x

# 6) ライザー(7.3〜8.85): 明るくなっていくノイズと、上がっていく音。8.85で切って一瞬の無音
i0, i1 = at(7.3), at(8.85)
L = i1 - i0
u = np.linspace(0, 1, L)
noise = rng.standard_normal(L)
riser = lowpass(noise, 0.01 + 0.35 * u ** 2) * (u ** 2.2)
sweep_f = 180 * (2 ** (2.6 * u))
sweep = np.sin(2 * np.pi * np.cumsum(sweep_f) / SR) * (u ** 2.5)
seg = 0.33 * riser + 0.07 * sweep
dry[i0:i1] += seg
wet_send[i0:i1] += seg * 0.5

# 7) ロゴが決まる(9.0秒): 低い響き + 短いアタック + 和音
k = np.clip(t - HIT, 0, None)
on = (t >= HIT).astype(float)
boom_f = 36 + 40 * np.exp(-k * 6)
boom = np.sin(2 * np.pi * np.cumsum(boom_f) / SR) * np.exp(-k * 1.6) * on
dry += 0.55 * boom
tr = np.zeros(n)
tr[at(HIT):at(HIT) + at(0.05)] = rng.standard_normal(at(0.05)) * np.linspace(1, 0, at(0.05))
tr = lowpass(tr, 0.25)
dry += 0.35 * tr; wet_send += 0.25 * tr
for f, g in [(146.83, 0.10), (220.0, 0.08), (293.66, 0.09), (369.99, 0.07), (659.25, 0.05), (880.0, 0.035)]:
    x = bell(f, HIT, g, decay=0.45)
    dry += x; wet_send += x * 1.4
# 頂点のきらめき
for st, f in [(HIT + 0.05, 2637.0), (HIT + 0.35, 2959.96), (HIT + 0.7, 3520.0)]:
    x = bell(f, st, 0.012, decay=3)
    dry += x; wet_send += x * 2

# 残響(長く減衰するノイズとのたたみこみ)
ir_len = at(3.2)
ir = rng.standard_normal(ir_len) * np.exp(-np.arange(ir_len) / SR * 1.9)
ir = lowpass(ir, 0.18)
ir /= np.sqrt(np.sum(ir ** 2))
size = 1 << int(np.ceil(np.log2(n + ir_len)))
wet = np.fft.irfft(np.fft.rfft(wet_send, size) * np.fft.rfft(ir, size), size)[:n]
out = dry + 0.35 * wet

# 仕上げ: やわらかく音量をそろえ、最後は静かに消す
out = np.tanh(out * 1.3) / np.tanh(1.3)
out *= 0.9 / max(1e-6, np.max(np.abs(out)))
out *= np.clip((DUR - t) / 0.7, 0, 1)
stereo = np.stack([out, np.roll(out, 260) * 0.97], axis=1)
pcm = (stereo * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', sys.argv[1], len(pcm) / SR, 's')
