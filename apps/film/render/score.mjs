// The film's score, synthesised from nothing so the film has no licensed audio: a dark drone for the open, a pulse
// under the product, an impact on every cut, risers into the big moments, and soft clicks where the cursor clicks.
// Times follow the cut in src/Film.tsx. Writes out/score.wav (48 kHz, 16-bit stereo).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SR = 48000;
const LENGTH = 110;
const N = SR * LENGTH;
const L = new Float32Array(N);
const R = new Float32Array(N);
const verbL = new Float32Array(N);
const verbR = new Float32Array(N);

let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Adds a mono signal, panned, with a reverb send. */
function add(start, dur, fn, { gain = 1, pan = 0, send = 0.2 } = {}) {
  const s0 = Math.max(0, Math.floor(start * SR));
  const s1 = Math.min(N, Math.floor((start + dur) * SR));
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = s0; i < s1; i++) {
    const t = (i - s0) / SR;
    const v = fn(t, dur);
    L[i] += v * gl;
    R[i] += v * gr;
    verbL[i] += v * gl * send;
    verbR[i] += v * gr * send;
  }
}

const env = (t, dur, a, r) => clamp(t / a, 0, 1) * clamp((dur - t) / r, 0, 1);

/** A warm pad: detuned saws through a soft low-pass, slow swell. */
function pad(start, dur, notes, { gain = 0.05, cutoff = 1400, attack = 1.5, release = 1.5, pan = 0 } = {}) {
  for (const [k, midi] of notes.entries()) {
    for (const detune of [-0.08, 0.08]) {
      const f = hz(midi + detune);
      let y = 0;
      let phase = (noise() + 1) / 2;
      const a = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
      add(start, dur, (t, d) => {
        phase += f / SR;
        phase -= Math.floor(phase);
        const saw = 2 * phase - 1;
        y += a * (saw - y);
        return y * env(t, d, attack, release);
      }, { gain: gain / notes.length, pan: pan + (detune < 0 ? -0.35 : 0.35) * (k % 2 ? 1 : -1), send: 0.45 });
    }
  }
}

/** A sub drone with slow beating. */
function drone(start, dur, midi, gain = 0.12) {
  const f = hz(midi);
  add(start, dur, (t, d) => (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(2 * Math.PI * f * 2.003 * t) + 0.15 * Math.sin(2 * Math.PI * f * 3.01 * t)) * env(t, d, 2.5, 2.5) * (0.85 + 0.15 * Math.sin(t * 0.7)), { gain, send: 0.15 });
}

/** A plucked note: a decaying, slightly bright tone. */
function pluck(start, midi, { gain = 0.08, decay = 0.35, pan = 0, send = 0.35 } = {}) {
  const f = hz(midi);
  add(start, decay * 5, (t) => {
    const e = Math.exp(-t / decay);
    return (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t) * Math.exp(-t / (decay * 0.4)) + 0.12 * Math.sin(6 * Math.PI * f * t) * Math.exp(-t / (decay * 0.25))) * e * Math.min(1, t * 400);
  }, { gain, pan, send });
}

/** A cinematic impact: a falling sub, a noise burst, a long tail. */
function impact(at, gain = 0.6) {
  gain *= 0.4;
  add(at, 3.5, (t) => {
    const f = 30 + 90 * Math.exp(-t * 9);
    return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 1.6) * Math.min(1, t * 300);
  }, { gain, send: 0.25 });
  let y = 0;
  add(at, 1.4, (t) => {
    y += 0.12 * (noise() - y);
    return y * Math.exp(-t * 5) * 2.2;
  }, { gain: gain * 0.5, send: 0.7 });
}

/** A riser: filtered noise opening up and getting louder into a cut, with a rising tone. */
function riser(end, dur = 2.5, gain = 0.12) {
  let y = 0;
  add(end - dur, dur, (t, d) => {
    const p = t / d;
    const a = 0.01 + 0.5 * p * p;
    y += a * (noise() - y);
    const tone = Math.sin(2 * Math.PI * (200 + 900 * p * p) * t) * 0.15;
    return (y + tone) * p * p * (1 - clamp((t - d + 0.03) / 0.03, 0, 1));
  }, { gain, send: 0.5 });
}

/** A short UI click. */
function click(at, gain = 0.25) {
  add(at, 0.06, (t) => (noise() * 0.5 + Math.sin(2 * Math.PI * 2400 * t)) * Math.exp(-t * 120), { gain, send: 0.1 });
}

/** A keyboard key going down: a thock. */
function key(at, gain = 0.5) {
  add(at, 0.25, (t) => (Math.sin(2 * Math.PI * (180 - 80 * t) * t) * Math.exp(-t * 28) + noise() * Math.exp(-t * 90) * 0.4), { gain, send: 0.2 });
}

/** Kick and hat for the driving section. */
function kick(at, gain = 0.5) {
  gain *= 0.55;
  add(at, 0.45, (t) => Math.sin(2 * Math.PI * (45 + 110 * Math.exp(-t * 30)) * t) * Math.exp(-t * 7), { gain, send: 0.05 });
}
function hat(at, gain = 0.06) {
  let prev = 0;
  add(at, 0.08, (t) => {
    const n = noise();
    const hp = n - prev;
    prev = n;
    return hp * Math.exp(-t * 60);
  }, { gain, pan: 0.3, send: 0.1 });
}

// ---- the arrangement ----
// D minor; bars of the pulse are 2.18s (110 bpm, 4 beats).
const BEAT = 60 / 110;
const Dm = [50, 53, 57, 62];
const Bb = [46, 50, 53, 58];
const F = [45, 48, 53, 57];
const C = [48, 52, 55, 60];
const Fmaj9 = [41, 48, 52, 55, 57, 64];

// Open: drone and wind, a tick per second like a clock.
drone(0, 13.2, 26, 0.09);
drone(0, 13.2, 33, 0.06);
pad(1.0, 12.4, [62, 65, 69], { gain: 0.035, cutoff: 700, attack: 3, release: 1 });
for (let s = 1.5; s < 7; s += 1) click(s, 0.05);
// The question: hard cuts, then a heartbeat under "Are we okay?"
for (const at of [7.5, 8.45, 9.4, 10.35]) impact(at, 0.32);
for (const at of [11.2, 11.55, 12.2, 12.55]) kick(at, 0.45);
riser(13, 1.8, 0.1);
// Title.
impact(13, 0.7);
pad(13, 6.4, [46, 53, 58, 62, 65, 72], { gain: 0.06, cutoff: 2200, attack: 0.6, release: 2 });
drone(13, 6.4, 34, 0.1);

// The pulse under the product, 19–55s.
const progression = [Dm, Bb, F, C];
for (let bar = 0; 19 + bar * BEAT * 4 < 55; bar++) {
  const at = 19 + bar * BEAT * 4;
  const chord = progression[bar % 4];
  pad(at, BEAT * 4 + 0.6, chord.map((m) => m + 12), { gain: 0.075, cutoff: 1300, attack: 0.8, release: 0.8 });
  drone(at, BEAT * 4 + 0.3, chord[0] - 12, 0.1);
  for (let i = 0; i < 8; i++) {
    const note = chord[[0, 2, 3, 2, 1, 3, 2, 3][i]] + 24;
    pluck(at + (i * BEAT) / 2, note, { gain: 0.075 + (i % 4 === 0 ? 0.025 : 0), decay: 0.22, pan: i % 2 ? 0.4 : -0.4 });
  }
}
impact(19, 0.45);
impact(30, 0.45);
riser(39, 2, 0.1);
impact(39, 0.55);
click(19 + 2.2);
click(19 + 4.85);
key(39 + 0.95);
key(39 + 1.1);
click(39 + 5.2, 0.18);

// AI actions, 55–72.5: drums in, an impact on every verb.
riser(55, 2.2, 0.12);
for (const off of [0, 3.9, 7.4, 10.1, 14.0]) impact(55 + off, 0.5);
for (let b = 0; 55 + b * BEAT < 72.4; b++) {
  const at = 55 + b * BEAT;
  kick(at, 0.38);
  hat(at + BEAT / 2);
  if (b % 2) hat(at + BEAT * 0.75, 0.035);
  const chord = progression[Math.floor(b / 4) % 4];
  pluck(at, chord[b % 4] + 24, { gain: 0.04, decay: 0.18, pan: b % 2 ? 0.5 : -0.5 });
  if (b % 4 === 0) {
    pad(at, BEAT * 4 + 0.4, chord.map((m) => m + 12), { gain: 0.04, cutoff: 1800, attack: 0.3, release: 0.6 });
    drone(at, BEAT * 4 + 0.2, chord[0] - 12, 0.09);
  }
}
click(55 + 3.9 + 1.15, 0.2);

// Forecast: tension when the cash runs out, release when it's fixed.
impact(72.5, 0.5);
pad(72.5, 3.6, [50, 57, 62, 65], { gain: 0.05, cutoff: 1200, attack: 0.4, release: 0.6 });
drone(72.5, 10.5, 26, 0.12);
pad(75.8, 4.0, [49, 52, 56, 61], { gain: 0.07, cutoff: 2600, attack: 0.3, release: 0.4 });
for (let i = 0; i < 14; i++) kick(75.9 + i * 0.27, 0.22 + i * 0.012);
impact(80.0, 0.4);
pad(80, 3.5, F.map((m) => m + 12), { gain: 0.06, cutoff: 2200, attack: 0.2, release: 1.2 });

// Trust: warm and still.
impact(83, 0.45);
for (let bar = 0; bar < 6; bar++) {
  const at = 83 + bar * BEAT * 4;
  const chord = [F, C, Dm, Bb, F, C][bar];
  pad(at, BEAT * 4 + 0.8, chord.map((m) => m + 12), { gain: 0.085, cutoff: 1500, attack: 1, release: 1 });
  for (let i = 0; i < 4; i++) pluck(at + i * BEAT, chord[(i + bar) % 4] + 24, { gain: 0.07, decay: 0.5, send: 0.6 });
}
click(83 + 3.0, 0.15);

// Finale: the wall with the full pulse, then the promise on one big chord.
riser(96, 2.4, 0.1);
impact(96, 0.6);
for (let b = 0; 96 + b * BEAT < 101.6; b++) {
  kick(96 + b * BEAT, 0.34);
  hat(96 + b * BEAT + BEAT / 2);
  pluck(96 + b * BEAT, [65, 69, 72, 76][b % 4], { gain: 0.04, decay: 0.2 });
}
pad(96, 5.8, Bb.map((m) => m + 12), { gain: 0.05, cutoff: 1800 });
riser(102, 1.4, 0.08);
impact(102, 0.8);
pad(102, 8, Fmaj9.map((m) => m + 12), { gain: 0.08, cutoff: 2400, attack: 0.2, release: 4 });
drone(102, 8, 29, 0.16);
for (let i = 0; i < 6; i++) pluck(104.6 + i * 0.3, Fmaj9[i] + 24, { gain: 0.035, decay: 0.8, send: 0.7 });

// ---- reverb: four combs and two all-passes per side ----
function reverb(input, delays) {
  const out = new Float32Array(N);
  for (const d of delays.combs) {
    const buf = new Float32Array(d);
    let i = 0;
    let lp = 0;
    for (let n = 0; n < N; n++) {
      const y = buf[i];
      lp = y * 0.7 + lp * 0.3;
      buf[i] = input[n] + lp * 0.84;
      out[n] += y * 0.25;
      i = (i + 1) % d;
    }
  }
  for (const d of delays.allpass) {
    const buf = new Float32Array(d);
    let i = 0;
    for (let n = 0; n < N; n++) {
      const b = buf[i];
      const y = -out[n] + b;
      buf[i] = out[n] + b * 0.5;
      out[n] = y;
      i = (i + 1) % d;
    }
  }
  return out;
}
const wetL = reverb(verbL, { combs: [1557, 1617, 1491, 1422].map((d) => d * 2), allpass: [225, 556] });
const wetR = reverb(verbR, { combs: [1580, 1640, 1514, 1445].map((d) => d * 2), allpass: [248, 579] });

// ---- master: mix, soft clip, fade in and out, 16-bit ----
const pcm = Buffer.alloc(N * 4);
let peak = 0;
for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n] + wetL[n] * 0.5), Math.abs(R[n] + wetR[n] * 0.5));
const norm = 0.9 / Math.max(peak, 1e-6);
for (let n = 0; n < N; n++) {
  const t = n / SR;
  const fade = clamp(t / 0.05, 0, 1) * clamp((LENGTH - t) / 2.5, 0, 1);
  const l = Math.tanh((L[n] + wetL[n] * 0.5) * norm * 1.6) * fade;
  const r = Math.tanh((R[n] + wetR[n] * 0.5) * norm * 1.6) * fade;
  pcm.writeInt16LE(Math.round(l * 32767), n * 4);
  pcm.writeInt16LE(Math.round(r * 32767), n * 4 + 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 4, 28);
header.writeUInt16LE(4, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);
const out = resolve(root, "out/score.wav");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.concat([header, pcm]));
console.log(`Wrote ${out}`);
