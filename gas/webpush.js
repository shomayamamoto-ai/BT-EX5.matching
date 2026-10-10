// ============================================
// gas/webpush.js — Web プッシュ通知(iPhone・Android・パソコン)を送るための署名
//
// Web プッシュでは、送り手であることを示す VAPID(ES256 = P-256 の ECDSA 署名)が必要。
// Apps Script には ES256 の署名がないため、ここで P-256 の計算を BigInt で行う。
// 送るのは「中身のない合図」だけ(中身の暗号化はしない)。合図を受けた端末の
// サービスワーカー(sw.js)が、会員サイトから最新のお知らせを取りに来て表示する。
//
// 使い方(gas/main.js):
//   var keys = WebPush.generateKeys(randomBytes)      // { privateHex, publicKey }(初回だけ)
//   var auth = WebPush.vapidHeader(endpoint, keys, subject, nowSec, hmacSha256)
//   → Authorization ヘッダーの値("vapid t=..., k=...")
// ============================================

var WebPush = (function () {
  "use strict";

  // ---------- P-256(secp256r1) ----------
  var P = BigInt("0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff");
  var N = BigInt("0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551");
  var A = P - BigInt(3);
  var GX = BigInt("0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296");
  var GY = BigInt("0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5");
  var ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), THREE = BigInt(3);

  function mod(a, m) { var r = a % m; return r < ZERO ? r + m : r; }
  function inv(a, m) {
    // 拡張ユークリッド
    var lm = ONE, hm = ZERO, low = mod(a, m), high = m;
    while (low > ONE) {
      var r = high / low;
      var nm = hm - lm * r, nw = high - low * r;
      hm = lm; high = low; lm = nm; low = nw;
    }
    return mod(lm, m);
  }

  // ヤコビアン座標 [X, Y, Z]
  function dbl(p) {
    var X = p[0], Y = p[1], Z = p[2];
    if (Y === ZERO || Z === ZERO) return [ZERO, ONE, ZERO];
    var YY = mod(Y * Y, P);
    var S = mod(BigInt(4) * X * YY, P);
    var ZZ = mod(Z * Z, P);
    var M = mod(THREE * X * X + A * ZZ * ZZ, P);
    var X3 = mod(M * M - TWO * S, P);
    var Y3 = mod(M * (S - X3) - BigInt(8) * YY * YY, P);
    var Z3 = mod(TWO * Y * Z, P);
    return [X3, Y3, Z3];
  }
  function add(p, q) {
    if (p[2] === ZERO) return q;
    if (q[2] === ZERO) return p;
    var Z1Z1 = mod(p[2] * p[2], P), Z2Z2 = mod(q[2] * q[2], P);
    var U1 = mod(p[0] * Z2Z2, P), U2 = mod(q[0] * Z1Z1, P);
    var S1 = mod(p[1] * q[2] * Z2Z2, P), S2 = mod(q[1] * p[2] * Z1Z1, P);
    if (U1 === U2) return S1 === S2 ? dbl(p) : [ZERO, ONE, ZERO];
    var H = mod(U2 - U1, P), R = mod(S2 - S1, P);
    var HH = mod(H * H, P), HHH = mod(H * HH, P), V = mod(U1 * HH, P);
    var X3 = mod(R * R - HHH - TWO * V, P);
    var Y3 = mod(R * (V - X3) - S1 * HHH, P);
    var Z3 = mod(H * p[2] * q[2], P);
    return [X3, Y3, Z3];
  }
  function mul(k, x, y) {
    var R = [ZERO, ONE, ZERO], Q = [x, y, ONE];
    var bits = k.toString(2);
    for (var i = 0; i < bits.length; i++) {
      R = dbl(R);
      if (bits[i] === "1") R = add(R, Q);
    }
    if (R[2] === ZERO) throw new Error("point at infinity");
    var zi = inv(R[2], P), zi2 = mod(zi * zi, P);
    return [mod(R[0] * zi2, P), mod(R[1] * zi2 * zi, P)];
  }

  // ---------- 文字・バイト ----------
  function hexToBytes(h) { var o = []; for (var i = 0; i < h.length; i += 2) o.push(parseInt(h.substr(i, 2), 16)); return o; }
  function bytesToHex(b) { return b.map(function (x) { return ((x & 255) < 16 ? "0" : "") + (x & 255).toString(16); }).join(""); }
  function bigToBytes(n, len) { var h = n.toString(16); while (h.length < len * 2) h = "0" + h; return hexToBytes(h); }
  function bytesToBig(b) { return b.length ? BigInt("0x" + bytesToHex(b)) : ZERO; }
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function b64url(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i += 3) {
      var n = ((bytes[i] & 255) << 16) | (((bytes[i + 1] || 0) & 255) << 8) | ((bytes[i + 2] || 0) & 255);
      out += B64[(n >>> 18) & 63] + B64[(n >>> 12) & 63];
      if (i + 1 < bytes.length) out += B64[(n >>> 6) & 63];
      if (i + 2 < bytes.length) out += B64[n & 63];
    }
    return out;
  }
  function utf8(s) {
    var t = unescape(encodeURIComponent(String(s)));
    var o = new Array(t.length);
    for (var i = 0; i < t.length; i++) o[i] = t.charCodeAt(i);
    return o;
  }

  // ---------- 鍵 ----------
  // randomBytes(n) → 0〜255 の配列
  function generateKeys(randomBytes) {
    var d = ZERO;
    while (d === ZERO || d >= N) d = bytesToBig(randomBytes(32));
    var Q = mul(d, GX, GY);
    return { privateHex: d.toString(16), publicKey: b64url([4].concat(bigToBytes(Q[0], 32), bigToBytes(Q[1], 32))) };
  }

  // ---------- ECDSA 署名(k は RFC 6979 で決める。乱数の質に頼らない) ----------
  // hmac(keyBytes, msgBytes) → 32バイトの配列
  function sign(msgBytes, privateHex, sha256Bytes, hmac) {
    var d = BigInt("0x" + privateHex);
    var h1 = sha256Bytes(msgBytes);
    var e = bytesToBig(h1);
    var x = bigToBytes(d, 32), hb = bigToBytes(mod(e, N), 32);
    var V = [], K = [], i;
    for (i = 0; i < 32; i++) { V.push(1); K.push(0); }
    K = hmac(K, V.concat([0], x, hb)); V = hmac(K, V);
    K = hmac(K, V.concat([1], x, hb)); V = hmac(K, V);
    for (;;) {
      V = hmac(K, V);
      var k = bytesToBig(V);
      if (k > ZERO && k < N) {
        var R = mul(k, GX, GY);
        var r = mod(R[0], N);
        var s = mod(inv(k, N) * (e + r * d), N);
        if (r !== ZERO && s !== ZERO) return bigToBytes(r, 32).concat(bigToBytes(s, 32));
      }
      K = hmac(K, V.concat([0])); V = hmac(K, V);
    }
  }

  // VAPID の Authorization ヘッダー(RFC 8292)
  function vapidHeader(endpoint, keys, subject, nowSec, sha256Bytes, hmac) {
    var aud = String(endpoint).match(/^https:\/\/[^/]+/)[0];
    var header = b64url(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
    var payload = b64url(utf8(JSON.stringify({ aud: aud, exp: nowSec + 12 * 60 * 60, sub: subject })));
    var input = header + "." + payload;
    var sig = sign(utf8(input), keys.privateHex, sha256Bytes, hmac);
    return "vapid t=" + input + "." + b64url(sig) + ", k=" + keys.publicKey;
  }

  return { generateKeys: generateKeys, sign: sign, vapidHeader: vapidHeader, b64url: b64url, utf8: utf8 };
})();
