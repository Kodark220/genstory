import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import "./index.css";

/* ── Google Fonts ── */
(() => {
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Syne:wght@400;600;700;800&family=Fira+Code:wght@300;400;500&display=swap";
  document.head.appendChild(l);
})();

/* ── Constants ── */
const GOLD   = "#c8922a";
const GOLD2  = "#e8b84b";
const DARK   = "#04040a";
const CARD   = "#0d0d18";
const BORDER = "#1e1e30";
const MUTED  = "#5a5470";

const FEATURES = [
  { icon: "✦", title: "AI-Woven Chapters", body: "Every turn calls the Oracle. Your action folds into the story's living history and emerges as the next chapter — atmospheric, immersive, never repeated." },
  { icon: "◈", title: "GEN Staking", body: "Lock tokens when you join. The prize pot grows with every new player. Nobody leaves with the gold until the story reaches its end." },
  { icon: "⚖", title: "On-Chain Judging", body: "When the final chapter falls, the LLM reads the full tale and scores each player's contributions. Validators reach consensus. The winner is crowned on-chain." },
  { icon: "⊕", title: "Parallel Stories", body: "One contract runs hundreds of tales simultaneously. Dark fantasy beside cosmic horror beside noir. Every story isolated, every pot separate." },
];

const STEPS = [
  { num: "01", label: "Create", desc: "Choose a genre, plant a seed idea, stake your opening GEN." },
  { num: "02", label: "Join",   desc: "Any player can enter an active story, add their stake to the pot." },
  { num: "03", label: "Weave",  desc: "Submit actions in plain English. The Oracle continues the tale." },
  { num: "04", label: "Win",    desc: "End the story. The LLM judges. The pot goes to the best storyteller." },
];

const STORIES = [
  { genre: "Dark Fantasy",   seed: "A cartographer whose maps come alive at midnight.", pot: "340.00", chapters: 12, players: 4 },
  { genre: "Cosmic Horror",  seed: "Your starship drops out of warp inside a hollow planet.", pot: "190.50", chapters: 7, players: 3 },
  { genre: "Noir Mystery",   seed: "A detective receives a case file dated tomorrow.", pot: "512.00", chapters: 19, players: 6 },
];

/* ── Particle field ── */
const Particles = () => {
  const particles = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: 2 + Math.random() * 3,
    dur: 4 + Math.random() * 8,
    del: Math.random() * 8,
    dx: (Math.random() - .5) * 60,
    dr: (Math.random() - .5) * 360,
  }));
  return (
    <div style={{ position:"absolute", inset:0, overflow:"hidden", pointerEvents:"none" }}>
      {particles.map(p => (
        <div key={p.id} className="drift-particle" style={{
          position:"absolute",
          bottom: 0,
          left: `${p.x}%`,
          width: p.size,
          height: p.size,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${GOLD2}, ${GOLD})`,
          "--dur": `${p.dur}s`,
          "--del": `${p.del}s`,
          "--dx": `${p.dx}px`,
          "--dr": `${p.dr}deg`,
        } as React.CSSProperties} />
      ))}
    </div>
  );
};

/* ── Animated rune divider ── */
const RuneDivider = ({ label }: { label: string }) => (
  <motion.div
    initial={{ opacity: 0, scaleX: 0 }}
    whileInView={{ opacity: 1, scaleX: 1 }}
    viewport={{ once: true }}
    transition={{ duration: .8, ease: "easeOut" }}
    style={{ display:"flex", alignItems:"center", gap:16, margin:"0 auto", maxWidth:480 }}
  >
    <div style={{ flex:1, height:1, background:`linear-gradient(to right, transparent, ${BORDER})` }} />
    <span style={{ fontFamily:"'Fira Code',monospace", fontSize:11, color:MUTED, letterSpacing:".15em" }}>{label}</span>
    <div style={{ flex:1, height:1, background:`linear-gradient(to left, transparent, ${BORDER})` }} />
  </motion.div>
);

/* ── Feature card ── */
const FeatureCard = ({ icon, title, body, i }: { icon: string; title: string; body: string; i: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity:0, y:40 }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:.6, delay: i * .12, ease:[.22,1,.36,1] }}
    >
      <Card style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:8, height:"100%", overflow:"hidden", position:"relative" }}>
        <motion.div
          whileHover={{ opacity:1 }}
          initial={{ opacity:0 }}
          style={{
            position:"absolute", inset:0, pointerEvents:"none",
            background:`radial-gradient(ellipse at 50% 0%, ${GOLD}18 0%, transparent 65%)`,
          }}
        />
        <CardContent style={{ padding:28 }}>
          <motion.div
            whileHover={{ scale:1.1, rotate: 10 }}
            transition={{ type:"spring", stiffness:300 }}
            style={{ fontSize:28, marginBottom:16, display:"inline-block", color:GOLD }}
          >
            {icon}
          </motion.div>
          <h3 className="font-sans" style={{ fontSize:16, fontWeight:700, color:"#f0ead8", marginBottom:10, letterSpacing:".02em" }}>{title}</h3>
          <p className="font-display" style={{ fontSize:15, color:MUTED, lineHeight:1.8, fontStyle:"italic" }}>{body}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

/* ── Story preview card ── */
const StoryPreview = ({ genre, seed, pot, chapters, players, i }: {
  genre: string; seed: string; pot: string; chapters: number; players: number; i: number;
}) => (
  <motion.div
    initial={{ opacity:0, x: i % 2 === 0 ? -30 : 30 }}
    whileInView={{ opacity:1, x:0 }}
    viewport={{ once:true, margin:"-40px" }}
    transition={{ duration:.6, delay: i * .1, ease:[.22,1,.36,1] }}
    whileHover={{ y:-4, borderColor: GOLD + "66" }}
    style={{
      background:CARD, border:`1px solid ${BORDER}`, borderRadius:8,
      padding:"20px 24px", cursor:"pointer", transition:"border-color .2s",
    }}
  >
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:12 }}>
      <Badge style={{ background:`${GOLD}18`, color:GOLD, border:`1px solid ${GOLD}44`, fontFamily:"'Fira Code',monospace", fontSize:10, padding:"2px 10px" }}>
        {genre}
      </Badge>
      <span className="font-mono" style={{ fontSize:12, color:GOLD, fontWeight:500 }}>{pot} ◈ GEN</span>
    </div>
    <p className="font-display" style={{ fontSize:15, fontStyle:"italic", color:"#c8c0b0", lineHeight:1.7, marginBottom:12 }}>"{seed}"</p>
    <div style={{ display:"flex", gap:16 }}>
      <span className="font-mono" style={{ fontSize:10, color:MUTED }}>📜 {chapters} chapters</span>
      <span className="font-mono" style={{ fontSize:10, color:MUTED }}>👥 {players} players</span>
    </div>
  </motion.div>
);

/* ── Step ── */
const Step = ({ num, label, desc, i }: { num: string; label: string; desc: string; i: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once:true, margin:"-50px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity:0, y:30 }}
      animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:.55, delay: i * .15 }}
      style={{ display:"flex", gap:20, alignItems:"flex-start" }}
    >
      <div style={{ flexShrink:0, width:48, height:48, border:`1px solid ${GOLD}44`, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span className="font-mono" style={{ fontSize:12, color:GOLD }}>{num}</span>
      </div>
      <div>
        <h4 className="font-sans" style={{ fontSize:17, fontWeight:700, color:"#f0ead8", marginBottom:4 }}>{label}</h4>
        <p className="font-display" style={{ fontSize:14, fontStyle:"italic", color:MUTED, lineHeight:1.7 }}>{desc}</p>
      </div>
    </motion.div>
  );
};

/* ── Stat counter ── */
const Stat = ({ value, label, i }: { value: string; label: string; i: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once:true });
  const [count, setCount] = useState(0);
  const num = parseInt(value);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = Math.ceil(num / 40);
    const t = setInterval(() => {
      start += step;
      if (start >= num) { setCount(num); clearInterval(t); }
      else setCount(start);
    }, 30);
    return () => clearInterval(t);
  }, [inView, num]);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity:0, scale:.8 }}
      animate={inView ? { opacity:1, scale:1 } : {}}
      transition={{ duration:.5, delay: i * .1 }}
      style={{ textAlign:"center" }}
    >
      <div className="font-display" style={{ fontSize:52, fontWeight:600, color:GOLD, lineHeight:1, marginBottom:6 }}>
        {count}{value.includes("+") ? "+" : ""}
      </div>
      <div className="font-sans" style={{ fontSize:11, letterSpacing:".12em", color:MUTED, textTransform:"uppercase" }}>{label}</div>
    </motion.div>
  );
};

/* ── Navbar ── */
const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);
  return (
    <motion.nav
      initial={{ y:-60, opacity:0 }}
      animate={{ y:0, opacity:1 }}
      transition={{ duration:.7, ease:[.22,1,.36,1] }}
      style={{
        position:"fixed", top:0, left:0, right:0, zIndex:50,
        padding:"0 32px", height:60,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        background: scrolled ? `${DARK}ee` : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid ${BORDER}` : "none",
        transition:"all .3s",
      }}
    >
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <motion.span
          animate={{ rotate:[0,5,-5,0] }}
          transition={{ duration:4, repeat:Infinity, ease:"easeInOut" }}
          style={{ fontSize:20, color:GOLD }}
        >✦</motion.span>
        <span className="font-sans" style={{ fontSize:14, fontWeight:700, letterSpacing:".08em", color:"#f0ead8" }}>STORY WEAVER</span>
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <Button variant="ghost" style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:MUTED, letterSpacing:".06em" }}>
          Docs
        </Button>
        <Button style={{
          background:`linear-gradient(135deg, ${GOLD}, #a07020)`,
          color:DARK, fontFamily:"'Syne',sans-serif", fontSize:12,
          fontWeight:700, letterSpacing:".06em", border:"none",
        }}>
          Launch App →
        </Button>
      </div>
    </motion.nav>
  );
};

/* ── HERO ── */
const Hero = () => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const y   = useTransform(scrollYProgress, [0,1], [0, 120]);
  const opacity = useTransform(scrollYProgress, [0,.6], [1, 0]);

  const words = ["Adventure.", "Mystery.", "Horror.", "Legend."];
  const [wi, setWi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setWi(v => (v+1) % words.length), 2400);
    return () => clearInterval(t);
  }, []);

  return (
    <motion.section
      ref={ref}
      style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}
    >
      {/* Background radial */}
      <div style={{
        position:"absolute", inset:0,
        background:`radial-gradient(ellipse 80% 60% at 50% 40%, ${GOLD}12 0%, transparent 60%)`,
        pointerEvents:"none",
      }} />

      {/* Grid lines */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:`linear-gradient(${BORDER}44 1px, transparent 1px), linear-gradient(90deg, ${BORDER}44 1px, transparent 1px)`,
        backgroundSize:"60px 60px",
        maskImage:"radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
      }} />

      <Particles />

      <motion.div style={{ y, opacity, position:"relative", textAlign:"center", padding:"0 24px", maxWidth:820 }}>
        <motion.div
          initial={{ opacity:0, y:20 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:.6 }}
        >
          <Badge style={{ background:`${GOLD}18`, color:GOLD, border:`1px solid ${GOLD}44`, fontFamily:"'Fira Code',monospace", fontSize:11, padding:"4px 14px", marginBottom:28 }}>
            ◈ Powered by Genlayer · On-Chain AI Storytelling
          </Badge>
        </motion.div>

        <motion.h1
          className="font-display"
          initial={{ opacity:0, y:30 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:.8, delay:.15 }}
          style={{ fontSize:"clamp(52px, 9vw, 96px)", fontWeight:600, lineHeight:1.05, letterSpacing:"-.01em", marginBottom:12 }}
        >
          Weave Tales.<br />
          <span style={{ color:GOLD, fontStyle:"italic" }}>Win Gold.</span>
        </motion.h1>

        <motion.div
          initial={{ opacity:0, y:20 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:.7, delay:.3 }}
          style={{ height:56, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:20, overflow:"hidden" }}
        >
          <span className="font-display" style={{ fontSize:"clamp(22px,4vw,38px)", fontStyle:"italic", color:MUTED, marginRight:12 }}>A saga of</span>
          <AnimatePresence mode="wait">
            <motion.span
              key={wi}
              initial={{ y:30, opacity:0 }}
              animate={{ y:0, opacity:1 }}
              exit={{ y:-30, opacity:0 }}
              transition={{ duration:.4 }}
              className="font-display"
              style={{ fontSize:"clamp(22px,4vw,38px)", fontStyle:"italic", color:GOLD }}
            >
              {words[wi]}
            </motion.span>
          </AnimatePresence>
        </motion.div>

        <motion.p
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          transition={{ duration:.7, delay:.45 }}
          className="font-display"
          style={{ fontSize:18, fontStyle:"italic", color:MUTED, lineHeight:1.8, maxWidth:580, margin:"0 auto 40px" }}
        >
          A collaborative AI storytelling game on Genlayer. Stake tokens, shape the narrative, and let the Oracle judge who told the finest tale.
        </motion.p>

        <motion.div
          initial={{ opacity:0, y:16 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:.6, delay:.6 }}
          style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}
        >
          <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:.97 }}>
            <Button size="lg" style={{
              background:`linear-gradient(135deg, ${GOLD}, #a07020)`,
              color:DARK, fontFamily:"'Syne',sans-serif", fontWeight:800,
              fontSize:13, letterSpacing:".08em", padding:"14px 32px", border:"none",
              boxShadow:`0 0 32px ${GOLD}44`,
            }}>
              ✦ Begin Your Story
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:.97 }}>
            <Button variant="outline" size="lg" style={{
              border:`1px solid ${BORDER}`, background:"transparent",
              color:"#c8c0b0", fontFamily:"'Syne',sans-serif",
              fontSize:13, letterSpacing:".06em", padding:"14px 32px",
            }}>
              View Live Stories →
            </Button>
          </motion.div>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          transition={{ delay:1.4 }}
          style={{ marginTop:64 }}
        >
          <motion.div
            animate={{ y:[0,8,0] }}
            transition={{ duration:2, repeat:Infinity }}
            style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:6, color:MUTED }}
          >
            <span className="font-mono" style={{ fontSize:10, letterSpacing:".12em" }}>SCROLL</span>
            <div style={{ width:1, height:32, background:`linear-gradient(to bottom, ${MUTED}, transparent)` }} />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.section>
  );
};

/* ── STATS ── */
const Stats = () => (
  <section style={{ padding:"80px 24px", borderTop:`1px solid ${BORDER}`, borderBottom:`1px solid ${BORDER}` }}>
    <div style={{ maxWidth:800, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:40 }}>
      <Stat value="847+" label="Stories Woven" i={0} />
      <Stat value="3200+" label="Chapters Written" i={1} />
      <Stat value="12400+" label="GEN Distributed" i={2} />
      <Stat value="6" label="Active Genres" i={3} />
    </div>
  </section>
);

/* ── FEATURES ── */
const Features = () => (
  <section style={{ padding:"100px 24px" }}>
    <div style={{ maxWidth:900, margin:"0 auto" }}>
      <motion.div
        initial={{ opacity:0, y:24 }}
        whileInView={{ opacity:1, y:0 }}
        viewport={{ once:true }}
        transition={{ duration:.6 }}
        style={{ textAlign:"center", marginBottom:64 }}
      >
        <RuneDivider label="— THE MECHANICS —" />
        <h2 className="font-display" style={{ fontSize:"clamp(36px,6vw,58px)", fontWeight:600, marginTop:28, lineHeight:1.1 }}>
          Four Pillars of the <span style={{ color:GOLD, fontStyle:"italic" }}>Weave</span>
        </h2>
      </motion.div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px,1fr))", gap:16 }}>
        {FEATURES.map((f, i) => <FeatureCard key={i} {...f} i={i} />)}
      </div>
    </div>
  </section>
);

/* ── HOW IT WORKS ── */
const HowItWorks = () => (
  <section style={{ padding:"100px 24px", background:`linear-gradient(to bottom, transparent, ${CARD}44, transparent)` }}>
    <div style={{ maxWidth:700, margin:"0 auto" }}>
      <motion.div
        initial={{ opacity:0, y:24 }}
        whileInView={{ opacity:1, y:0 }}
        viewport={{ once:true }}
        style={{ textAlign:"center", marginBottom:64 }}
      >
        <RuneDivider label="— THE RITUAL —" />
        <h2 className="font-display" style={{ fontSize:"clamp(32px,5vw,52px)", fontWeight:600, marginTop:28 }}>
          How the <span style={{ color:GOLD, fontStyle:"italic" }}>Oracle</span> Works
        </h2>
      </motion.div>
      <div style={{ display:"flex", flexDirection:"column", gap:36, position:"relative" }}>
        <div style={{ position:"absolute", left:23, top:0, bottom:0, width:1, background:`linear-gradient(to bottom, transparent, ${BORDER}, transparent)` }} />
        {STEPS.map((s, i) => <Step key={i} {...s} i={i} />)}
      </div>
    </div>
  </section>
);

/* ── LIVE STORIES ── */
const LiveStories = () => (
  <section style={{ padding:"100px 24px" }}>
    <div style={{ maxWidth:780, margin:"0 auto" }}>
      <motion.div
        initial={{ opacity:0, y:24 }}
        whileInView={{ opacity:1, y:0 }}
        viewport={{ once:true }}
        style={{ textAlign:"center", marginBottom:64 }}
      >
        <RuneDivider label="— ACTIVE TALES —" />
        <h2 className="font-display" style={{ fontSize:"clamp(32px,5vw,52px)", fontWeight:600, marginTop:28 }}>
          Stories in <span style={{ color:GOLD, fontStyle:"italic" }}>Progress</span>
        </h2>
      </motion.div>
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {STORIES.map((s, i) => <StoryPreview key={i} {...s} i={i} />)}
      </div>
      <motion.div
        initial={{ opacity:0 }}
        whileInView={{ opacity:1 }}
        viewport={{ once:true }}
        style={{ textAlign:"center", marginTop:32 }}
      >
        <Button variant="outline" style={{ border:`1px solid ${BORDER}`, background:"transparent", color:MUTED, fontFamily:"'Syne',sans-serif", fontSize:12, letterSpacing:".06em" }}>
          View All 847 Stories →
        </Button>
      </motion.div>
    </div>
  </section>
);

/* ── CTA ── */
const CTA = () => (
  <section style={{ padding:"120px 24px", position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", inset:0, background:`radial-gradient(ellipse 70% 60% at 50% 50%, ${GOLD}0d 0%, transparent 70%)`, pointerEvents:"none" }} />
    <Particles />
    <motion.div
      initial={{ opacity:0, y:40 }}
      whileInView={{ opacity:1, y:0 }}
      viewport={{ once:true }}
      transition={{ duration:.8 }}
      style={{ position:"relative", textAlign:"center", maxWidth:600, margin:"0 auto" }}
    >
      <motion.div
        animate={{ rotate:360 }}
        transition={{ duration:20, repeat:Infinity, ease:"linear" }}
        style={{ fontSize:36, color:GOLD, display:"inline-block", marginBottom:24 }}
      >
        ✦
      </motion.div>
      <h2 className="font-display" style={{ fontSize:"clamp(36px,6vw,62px)", fontWeight:600, lineHeight:1.1, marginBottom:20 }}>
        Your saga<br /><span style={{ color:GOLD, fontStyle:"italic" }}>awaits its author.</span>
      </h2>
      <p className="font-display" style={{ fontSize:17, fontStyle:"italic", color:MUTED, lineHeight:1.8, marginBottom:40 }}>
        Stake your GEN. Shape the narrative. Let the Oracle crown you the finest storyteller in the realm.
      </p>
      <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:.97 }} style={{ display:"inline-block" }}>
        <Button size="lg" style={{
          background:`linear-gradient(135deg, ${GOLD}, #a07020)`,
          color:DARK, fontFamily:"'Syne',sans-serif", fontWeight:800,
          fontSize:14, letterSpacing:".1em", padding:"16px 40px", border:"none",
          boxShadow:`0 0 48px ${GOLD}55`,
        }}>
          ✦ ENTER THE REALM
        </Button>
      </motion.div>
    </motion.div>
  </section>
);

/* ── FOOTER ── */
const Footer = () => (
  <footer style={{ padding:"32px 24px", borderTop:`1px solid ${BORDER}`, textAlign:"center" }}>
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:12 }}>
      <span style={{ fontSize:16, color:GOLD }}>✦</span>
      <span className="font-sans" style={{ fontSize:12, fontWeight:700, letterSpacing:".1em", color:MUTED }}>STORY WEAVER</span>
    </div>
    <p className="font-mono" style={{ fontSize:10, color:MUTED, letterSpacing:".08em" }}>
      BUILT ON GENLAYER · AI-POWERED · ON-CHAIN FOREVER
    </p>
  </footer>
);

/* ── APP ── */
export default function App() {
  return (
    <div className="grain" style={{ minHeight:"100vh", background:DARK }}>
      <Nav />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <LiveStories />
      <CTA />
      <Footer />
    </div>
  );
}
