// Procedural lab sound effects — synthesised with the Web Audio API so the
// virtual lab feels physical (no audio asset files; works fully offline).
//
// Three continuous *loops* (boiling, stirring, pouring) are toggled on/off as
// the matching simulation state starts and stops, plus one-shot
// *grab* / *drop* / *clink* / *click* effects.  Everything routes through a
// single master gain so the whole lab can be muted at once.
//
// Browsers suspend an AudioContext until the first user gesture; every public
// method resumes it, and all of ours are reached via a click/drag, so the
// first sound always lands after a real interaction.

type LoopName = "boiling" | "stirring" | "pouring";

interface Loop {
  nodes: AudioNode[];        // everything to disconnect on stop
  gain: GainNode;            // per-loop level (faded in/out)
  stopTimers: number[];      // setInterval/Timeout handles to clear on stop
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private loops: Partial<Record<LoopName, Loop>> = {};
  private muted = false;
  // Persistent friction "scrape" bed for apparatus sliding on the bench. It is
  // kept silent (gain 0) when idle and only swells while the item is moving.
  private friction: { gain: GainNode; fadeTimer: number } | null = null;

  // ── Context bootstrap ─────────────────────────────────────────────────────
  private ensure(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  // Two seconds of white noise, reused as the grain for every textured loop.
  private noise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuffer) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    return this.noiseBuffer;
  }

  // ── Mute ──────────────────────────────────────────────────────────────────
  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 1, this.ctx.currentTime, 0.05);
    }
  }
  isMuted() {
    return this.muted;
  }

  // ── Loop control ──────────────────────────────────────────────────────────
  setLoop(name: LoopName, active: boolean) {
    if (active) this.startLoop(name);
    else this.stopLoop(name);
  }

  private startLoop(name: LoopName) {
    if (this.loops[name]) return; // already running
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.master);

    let loop: Loop;
    if (name === "boiling") loop = this.buildBoiling(ctx, gain);
    else if (name === "stirring") loop = this.buildStirring(ctx, gain);
    else loop = this.buildPouring(ctx, gain);

    // Fade in so loops never click on
    gain.gain.setTargetAtTime(this.loopLevel(name), ctx.currentTime, 0.12);
    this.loops[name] = loop;
  }

  private stopLoop(name: LoopName) {
    const loop = this.loops[name];
    if (!loop || !this.ctx) return;
    const t = this.ctx.currentTime;
    loop.gain.gain.setTargetAtTime(0, t, 0.12);
    loop.stopTimers.forEach((id) => clearInterval(id));
    // Disconnect after the fade-out completes
    window.setTimeout(() => {
      loop.nodes.forEach((n) => {
        try {
          (n as AudioScheduledSourceNode).stop?.();
        } catch {
          /* not a source node */
        }
        n.disconnect();
      });
      loop.gain.disconnect();
    }, 400);
    delete this.loops[name];
  }

  private loopLevel(name: LoopName): number {
    // Pouring kept gentle — the soft trickle of water settling into a glass,
    // not a hard splashing jet.
    return name === "boiling" ? 0.5 : name === "pouring" ? 0.16 : 0.32;
  }

  // ── Loop builders ─────────────────────────────────────────────────────────
  // Rolling boil: low filtered noise rumble + randomly scheduled bubble "bloops".
  private buildBoiling(ctx: AudioContext, gain: GainNode): Loop {
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 620;
    lp.Q.value = 0.7;
    const bed = ctx.createGain();
    bed.gain.value = 0.5;
    src.connect(lp).connect(bed).connect(gain);
    src.start();

    // Individual bubbles — short rising sine pops at random intervals
    const bubble = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      const f = 180 + Math.random() * 320;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.7, now + 0.05);
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.5, now + 0.008);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(og).connect(gain);
      osc.start(now);
      osc.stop(now + 0.1);
    };
    const timer = window.setInterval(() => {
      const pops = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < pops; i++) window.setTimeout(bubble, Math.random() * 110);
    }, 130);

    return { nodes: [src, lp, bed], gain, stopTimers: [timer] };
  }

  // Stirring: a glass rod worked round a beaker of liquid. Two layers, both
  // locked to the *visual* rod speed so the sound and the animation agree:
  //   • a soft, dark water "swish" that swells once per stir sweep, and
  //   • a gentle glassy "knock" each cycle as the rod brushes the beaker wall.
  //
  // The on-screen rod tilts as sin(frame * 0.40) advanced once per animation
  // frame (~60 fps) → 0.40·60 = 24 rad/s → ~3.8 Hz full back-and-forth, a
  // ~262 ms cycle. The audio is tuned to that so the swish/knock keep pace with
  // the rod. STIR_HZ / STIR_MS below ARE that visual cadence — keep them in sync
  // if the rod's 0.40 factor in InteractiveLabCanvas ever changes.
  private buildStirring(ctx: AudioContext, gain: GainNode): Loop {
    const STIR_HZ = 3.8;             // full back-and-forth sweeps per second
    const STIR_MS = 1000 / STIR_HZ;  // ms per stir cycle (~263 ms)

    // Water swish bed — dark band-passed noise (liquid, not airy hiss).
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 540;        // lower → wet, watery rather than papery
    bp.Q.value = 1.1;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1100;       // roll off the dry top-end swish
    const swish = ctx.createGain();
    swish.gain.value = 0.14;
    src.connect(bp).connect(lp).connect(swish).connect(gain);
    src.start();

    // The swish swells once per visible sweep — modulated at the rod's own rate
    // so the rhythm of the sound tracks the rod instead of racing it.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = STIR_HZ;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain).connect(swish.gain);
    lfo.start();

    // Glassy knock — the rounded tip tapping the beaker wall on each pass. A
    // short mid sine "tock" with a tiny noise tick, soft so it sits under the
    // swish as a rhythmic click rather than a bell.
    const knock = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "sine";
      const f = 780 + Math.random() * 220;            // slight per-tap variation
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.85, now + 0.05);
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.14, now + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      osc.connect(og).connect(gain);
      osc.start(now);
      osc.stop(now + 0.1);

      // Tiny contact tick — the hard "click" of glass on glass before the tock.
      const tk = ctx.createBufferSource();
      tk.buffer = this.noise(ctx);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2400;
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(0.0001, now);
      tg.gain.exponentialRampToValueAtTime(0.05, now + 0.001);
      tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
      tk.connect(hp).connect(tg).connect(gain);
      tk.start(now);
      tk.stop(now + 0.02);
    };
    // One knock per stir cycle, jittered a touch so it never sounds metronomic.
    const timer = window.setInterval(() => {
      window.setTimeout(knock, Math.random() * 40);
    }, STIR_MS);

    return { nodes: [src, bp, lp, swish, lfo, lfoGain], gain, stopTimers: [timer] };
  }

  // Pouring water INTO a glass of water. The earlier version leaned on a steady
  // band of noise, which read as a falling stream / distant waterfall. Real
  // pouring into a vessel is dominated instead by *burbling* — a busy run of
  // rounded glugs and plips bubbling through the liquid — over only a whisper of
  // trickle. So here the noise stream is dialled right back to a faint underlay
  // and the glug layer is made denser and bubblier, with the pitch rising as the
  // glass fills.
  private buildPouring(ctx: AudioContext, gain: GainNode): Loop {
    // Faint trickle underlay — just enough body to glue the glugs together. Kept
    // dark and quiet so it never becomes a hissy "stream".
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 300;
    bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 480;
    lp.Q.value = 0.4;
    const body = ctx.createGain();
    body.gain.value = 0.06;                // barely there — no waterfall hiss
    src.connect(bp).connect(lp).connect(body).connect(gain);
    src.start();

    // Rising pitch as the glass fills — climbs over a few seconds, then resets,
    // so a sustained pour keeps sounding like liquid rising in the vessel.
    let fill = 0;
    // Rounded "glug" — the wet bloop of water folding into water. Sine with a
    // soft attack and a quick upward chirp, low-passed so each one is mellow.
    const glug = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      const lp2 = ctx.createBiquadFilter();   // soften each bubble's edge
      lp2.type = "lowpass";
      lp2.frequency.value = 1000;
      osc.type = "sine";
      const base = 150 + fill * 170;                 // pitch rises as it "fills"
      const f = base + Math.random() * 50;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.05);
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.11, now + 0.02);    // soft attack
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);  // gentle tail
      osc.connect(og).connect(lp2).connect(gain);
      osc.start(now);
      osc.stop(now + 0.15);
      fill = fill >= 1 ? 0 : fill + 0.03;            // climb, then start over
    };
    // A busy, irregular burble — several overlapping glugs every beat so it
    // reads as water bubbling into a glass, not a thin metronomic drip.
    const timer = window.setInterval(() => {
      const n = 2 + Math.floor(Math.random() * 3);   // 2–4 glugs per beat
      for (let i = 0; i < n; i++) window.setTimeout(glug, Math.random() * 120);
    }, 130);

    return {
      nodes: [src, bp, lp, body],
      gain,
      stopTimers: [timer],
    };
  }

  // ── One-shots ─────────────────────────────────────────────────────────────
  // Picking a piece of apparatus off the table: a soft muted "tap" (filtered
  // noise thud) topped with a brief high glass "tink" so grabbing a beaker feels
  // tactile. Reached via a pointer-down gesture, so the context is always live.
  grab() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    // Soft thud — a short burst of low-passed noise (the hand/contact).
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const thud = ctx.createGain();
    thud.gain.setValueAtTime(0.0001, now);
    thud.gain.exponentialRampToValueAtTime(0.28, now + 0.005);
    thud.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    src.connect(lp).connect(thud).connect(this.master);
    src.start(now);
    src.stop(now + 0.1);

    // Glass "tink" — a quick high sine that decays fast.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2100, now);
    osc.frequency.exponentialRampToValueAtTime(1500, now + 0.05);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Setting a piece of apparatus down on the table / shelf: a firmer landing
  // than grab() — a low "knock" of the base hitting the surface plus a short
  // glass settle, so releasing a beaker sounds like it actually lands.
  drop() {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    // Knock — a punchy low thud (the base meeting the bench).
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const knock = ctx.createGain();
    knock.gain.setValueAtTime(0.0001, now);
    knock.gain.exponentialRampToValueAtTime(0.4, now + 0.004);
    knock.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    src.connect(lp).connect(knock).connect(this.master);
    src.start(now);
    src.stop(now + 0.16);

    // Low thump body — a quick sine drop reinforcing the impact's weight.
    const thump = ctx.createOscillator();
    const tg = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(160, now);
    thump.frequency.exponentialRampToValueAtTime(70, now + 0.12);
    tg.gain.setValueAtTime(0.0001, now);
    tg.gain.exponentialRampToValueAtTime(0.3, now + 0.006);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    thump.connect(tg).connect(this.master);
    thump.start(now);
    thump.stop(now + 0.16);

    // Glass settle "tink" — quieter than grab, decays fast.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1700, now);
    osc.frequency.exponentialRampToValueAtTime(1250, now + 0.06);
    g.gain.setValueAtTime(0.0001, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.08, now + 0.016);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Glass-on-glass "clink": fired when a beaker / measuring cylinder / container
  // is carried through the air and knocks into a beaker. A pair of bright,
  // fast-decaying inharmonic tones (the ring of struck glass) over a tiny noise
  // tick for the initial contact. `intensity` (0..1) scales the loudness so a
  // gentle tap is softer than a hard knock.
  clink(intensity = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const i = Math.max(0.25, Math.min(1, intensity));

    // Two detuned, inharmonic partials give the glassy "ting" its character.
    const partials = [
      { f: 2600, g: 0.22 },
      { f: 3870, g: 0.12 },
    ];
    for (const p of partials) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      const f = p.f * (0.97 + Math.random() * 0.06);   // slight per-hit variation
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 0.18);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(p.g * i, now + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + 0.22);
    }

    // Tiny high noise tick — the hard moment of contact before the ring.
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3000;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(0.16 * i, now + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    src.connect(hp).connect(ng).connect(this.master);
    src.start(now);
    src.stop(now + 0.03);
  }

  // Sliding friction: a small, dry "scrape" played while a piece of apparatus is
  // dragged ALONG the bench (never in the air). Driven by drag speed — call it on
  // each move tick and it swells with the motion, then fades itself out shortly
  // after the movement stops. `speed` is the per-tick pointer travel in px.
  slide(speed: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    if (!this.friction) {
      // Low, woody noise → reads as a base scraping over a hard table top.
      const src = ctx.createBufferSource();
      src.buffer = this.noise(ctx);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 260;
      bp.Q.value = 0.8;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 480;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(bp).connect(lp).connect(gain).connect(this.master);
      src.start();
      this.friction = { gain, fadeTimer: 0 };
    }

    const f = this.friction;
    // Subtle: a slow slide barely whispers, a quick one is still soft.
    const level = Math.min(0.1, 0.015 + Math.min(speed, 24) * 0.0045);
    f.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.03);
    // Re-arm the fade-out; if no further move ticks arrive the scrape dies away.
    if (f.fadeTimer) clearTimeout(f.fadeTimer);
    f.fadeTimer = window.setTimeout(() => {
      if (this.friction && this.ctx)
        this.friction.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
    }, 90);
  }

  // Stop the sliding scrape immediately (called when a drag is released).
  endSlide() {
    if (!this.friction || !this.ctx) return;
    if (this.friction.fadeTimer) clearTimeout(this.friction.fadeTimer);
    this.friction.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
  }

  // Normal mechanical push-button click for the hot-plate power button: a short
  // dry "tick" (a fast click transient + tiny noise snap), like a real switch.
  click(_on: boolean) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    // Click transient — a very short high blip that decays almost instantly.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.012);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.3, now + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.04);

    // Tiny noise snap layered under it for the plastic "tick" of the contact.
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(0.18, now + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
    src.connect(hp).connect(ng).connect(this.master);
    src.start(now);
    src.stop(now + 0.03);
  }
}

export const soundManager = new SoundManager();
