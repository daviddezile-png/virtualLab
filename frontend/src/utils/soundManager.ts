// Procedural lab sound effects — synthesised with the Web Audio API so the
// virtual lab feels physical (no audio asset files; works fully offline).
//
// Three continuous *loops* (boiling, stirring, pouring) are toggled on/off as
// the matching simulation state starts and stops, plus a movement-driven
// *slide* (friction of apparatus dragged across the table) and one-shot
// *grab* / *drop* / *click* effects.  Everything routes through a single master
// gain so the whole lab can be muted at once.
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
  // Gesture-driven friction loop — kept alive by repeated slide() calls and
  // auto-faded out shortly after the dragging pointer stops moving.
  private sliding: { gain: GainNode; nodes: AudioNode[]; bp: BiquadFilterNode; stopTimer: number | null } | null = null;
  private muted = false;

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
    return name === "boiling" ? 0.5 : name === "pouring" ? 0.26 : 0.32;
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

  // Stirring: airy band-passed noise swept by a slow LFO → rhythmic swish.
  private buildStirring(ctx: AudioContext, gain: GainNode): Loop {
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 850;
    bp.Q.value = 1.4;
    const swish = ctx.createGain();
    swish.gain.value = 0.18;
    src.connect(bp).connect(swish).connect(gain);
    src.start();

    // LFO modulates the swish amplitude (~2.2 Hz) for the back-and-forth motion
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 2.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.16;
    lfo.connect(lfoGain).connect(swish.gain);
    lfo.start();

    return { nodes: [src, bp, swish, lfo, lfoGain], gain, stopTimers: [] };
  }

  // Pouring: the sound of a drink / water being poured into a glass. A soft,
  // dark liquid stream (heavily low-passed noise — no hissy top end) carries a
  // steady run of rounded "glug" bubbles whose pitch drifts upward, the way a
  // filling vessel rises in tone as it fills.
  private buildPouring(ctx: AudioContext, gain: GainNode): Loop {
    // Liquid stream bed — narrow, dark noise so it reads as flowing water, not air.
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 480;
    bp.Q.value = 0.9;
    const lp = ctx.createBiquadFilter();   // roll off all the harsh hiss
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.Q.value = 0.5;
    const body = ctx.createGain();
    body.gain.value = 0.32;
    src.connect(bp).connect(lp).connect(body).connect(gain);
    src.start();

    // Slow swell so the stream breathes instead of sitting flat.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 1.6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.12;
    lfo.connect(lfoGain).connect(body.gain);
    lfo.start();

    // Rising pitch as the glass fills — climbs over a few seconds, then resets,
    // so a sustained pour keeps sounding like liquid rising in the vessel.
    let fill = 0;
    // Rounded "glug" bubbles — the gulping voice of liquid pouring into a glass.
    const glug = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = "sine";
      const base = 150 + fill * 240;                 // pitch rises as it "fills"
      const f = base + Math.random() * 60;
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.6, now + 0.05);
      og.gain.setValueAtTime(0.0001, now);
      og.gain.exponentialRampToValueAtTime(0.22, now + 0.012);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.connect(og).connect(gain);
      osc.start(now);
      osc.stop(now + 0.12);
      fill = fill >= 1 ? 0 : fill + 0.04;            // climb, then start over
    };
    // A steady, fairly dense stream of glugs — that classic "glug-glug" pour.
    const timer = window.setInterval(() => {
      const n = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) window.setTimeout(glug, Math.random() * 120);
    }, 140);

    return {
      nodes: [src, bp, lp, body, lfo, lfoGain],
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

  // Friction of apparatus sliding across the table. Called on every drag-move
  // tick while the pointer is actually moving: the first call spins up a soft
  // gritty scrape loop, each subsequent call keeps it alive, and it auto-fades
  // out shortly after movement stops (so a paused-but-held item is silent).
  //
  // `intensity` (0..1) reflects how fast the item is moving — a slow nudge is a
  // faint scrape, a quick drag is louder and a touch brighter, so the sound
  // tracks the actual motion rather than playing flat-out the whole time.
  slide(intensity = 1) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const i = Math.max(0, Math.min(1, intensity));

    if (!this.sliding) {
      const sg = ctx.createGain();
      sg.gain.value = 0;
      sg.connect(this.master);

      // Mid-band noise, low-passed → a dry "shhk" scrape rather than hiss.
      const src = ctx.createBufferSource();
      src.buffer = this.noise(ctx);
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1200;
      bp.Q.value = 0.8;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2600;
      const body = ctx.createGain();
      body.gain.value = 0.5;
      src.connect(bp).connect(lp).connect(body).connect(sg);
      src.start();

      this.sliding = { gain: sg, nodes: [src, bp, lp, body], bp, stopTimer: null };
    }

    const s = this.sliding;
    // Level rises with speed; faster drags also brighten the scrape a touch.
    s.gain.gain.setTargetAtTime(0.03 + 0.13 * i, ctx.currentTime, 0.03);
    s.bp.frequency.setTargetAtTime(1000 + 900 * i, ctx.currentTime, 0.05);
    if (s.stopTimer) clearTimeout(s.stopTimer);
    s.stopTimer = window.setTimeout(() => this.slideStop(), 90);
  }

  private slideStop() {
    const s = this.sliding;
    if (!s || !this.ctx) return;
    this.sliding = null;
    if (s.stopTimer) clearTimeout(s.stopTimer);
    s.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
    window.setTimeout(() => {
      s.nodes.forEach((n) => {
        try {
          (n as AudioScheduledSourceNode).stop?.();
        } catch {
          /* not a source node */
        }
        n.disconnect();
      });
      s.gain.disconnect();
    }, 250);
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
