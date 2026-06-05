import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchStats, getNetwork, getNetworks, setNetwork, readContract, writeContract } from "@/lib/genlayer";
import { restoreWallet, clearWallet, subscribeProviders, connectProvider, connectFallback } from "@/lib/wallet";
import type { WalletState, EIP6963ProviderDetail } from "@/lib/wallet";
import { generateOpeningChapter, generateNextChapter, generateJudgeResult } from "@/lib/ai";
import "./index.css";

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

/* ── Types ── */
interface StoryItem {
  id: string;
  genre: string;
  seed: string;
  status: string;
  pot: number;
  total_chapters: number;
  player_count: number;
  winner?: string;
  winner_reason?: string;
  max_chapters?: number;
  creator?: string;
  mode?: string;
  created_at?: string;
  time_elapsed?: number;
  is_expired?: boolean;
}

interface StoryChapter {
  number: number;
  text: string;
  player: string;
  action: string;
  suggestions: string[];
}

interface StoryPlayer {
  name: string;
  address: string;
  stake: number;
  choices_made: number;
}

interface StatsData {
  totalStories: number;
  activeStories: number;
  totalPlayers: number;
  pot: number;
}

/* ── Google Fonts Loader ── */
function FontLoader() {
  useEffect(() => {
    if (!document.querySelector('link[href*="Cormorant+Garamond"]')) {
      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600&family=Syne:wght@400;600;700;800&family=Fira+Code:wght@300;400;500&display=swap";
      document.head.appendChild(l);
    }
  }, []);
  return null;
}

/* ── Scroll helper ── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

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
const StoryPreview = ({ story, i, onClick }: { story: StoryItem; i: number; onClick: () => void }) => (
  <motion.div
    initial={{ opacity:0, x: i % 2 === 0 ? -30 : 30 }}
    whileInView={{ opacity:1, x:0 }}
    viewport={{ once:true, margin:"-40px" }}
    transition={{ duration:.6, delay: i * .1, ease:[.22,1,.36,1] }}
    whileHover={{ y:-4, borderColor: GOLD + "66" }}
    onClick={onClick}
    style={{
      background:CARD, border:`1px solid ${BORDER}`, borderRadius:8,
      padding:"20px 24px", cursor:"pointer", transition:"border-color .2s",
    }}
  >
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, gap:12 }}>
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        <Badge style={{ background:`${GOLD}18`, color:GOLD, border:`1px solid ${GOLD}44`, fontFamily:"'Fira Code',monospace", fontSize:10, padding:"2px 10px" }}>
          {story.genre}
        </Badge>
        <Badge style={{
          background: story.status === "active" ? "#22c55e18" : story.status === "ended" ? "#3b82f618" : "#ef444418",
          color: story.status === "active" ? "#22c55e" : story.status === "ended" ? "#3b82f6" : "#ef4444",
          border: `1px solid ${story.status === "active" ? "#22c55e44" : story.status === "ended" ? "#3b82f644" : "#ef444444"}`,
          fontFamily:"'Fira Code',monospace", fontSize:10, padding:"2px 10px"
        }}>
          {story.status}
        </Badge>
        <Badge style={{
          background: story.mode === "solo" ? `${MUTED}18` : `${GOLD}10`,
          color: story.mode === "solo" ? "#a8a29e" : GOLD2,
          border: `1px solid ${story.mode === "solo" ? `${BORDER}` : `${GOLD}33`}`,
          fontFamily:"'Fira Code',monospace", fontSize:9, padding:"2px 8px"
        }}>
          {story.mode === "solo" ? "Solo Mode" : "Branched Battle"}
        </Badge>
      </div>
      <span className="font-mono" style={{ fontSize:12, color:GOLD, fontWeight:500, whiteSpace:"nowrap" }}>{story.pot} ◈ GEN</span>
    </div>
    <p className="font-display" style={{ fontSize:15, fontStyle:"italic", color:"#c8c0b0", lineHeight:1.7, marginBottom:12 }}>"{story.seed}"</p>
    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
      <span className="font-mono" style={{ fontSize:10, color:MUTED }}>👥 {story.player_count} players</span>
      {story.winner && <span className="font-mono" style={{ fontSize:10, color:GOLD }}>🏆 Winner: {story.winner.slice(0,8)}…</span>}
    </div>
  </motion.div>
);

/* ── Loading skeleton ── */
const LoadingSkeleton = () => (
  <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
    {[0,1,2].map(i => (
      <motion.div key={i}
        animate={{ opacity:[0.3, 0.6, 0.3] }}
        transition={{ duration:1.5, repeat:Infinity, delay: i * 0.2 }}
        style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:8, padding:"20px 24px", height:120 }}
      />
    ))}
  </div>
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
const Stat = ({ value, label, i }: { value: number; label: string; i: number }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once:true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView || value === 0) return;
    let start = 0;
    const step = Math.max(1, Math.ceil(value / 40));
    const t = setInterval(() => {
      start += step;
      if (start >= value) { setCount(value); clearInterval(t); }
      else setCount(start);
    }, 30);
    return () => clearInterval(t);
  }, [inView, value]);
  return (
    <motion.div
      ref={ref}
      initial={{ opacity:0, scale:.8 }}
      animate={inView ? { opacity:1, scale:1 } : {}}
      transition={{ duration:.5, delay: i * .1 }}
      style={{ textAlign:"center" }}
    >
      <div className="font-display" style={{ fontSize:52, fontWeight:600, color:GOLD, lineHeight:1, marginBottom:6 }}>
        {count}
      </div>
      <div className="font-sans" style={{ fontSize:11, letterSpacing:".12em", color:MUTED, textTransform:"uppercase" }}>{label}</div>
    </motion.div>
  );
};

/* ── Wallet Modal ── */
const WalletModal = ({ onClose, onConnect }: { onClose: () => void; onConnect: (w: WalletState) => void }) => {
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [providers, setProviders] = useState<EIP6963ProviderDetail[]>([]);

  useEffect(() => {
    return subscribeProviders((newProviders) => {
      setProviders(newProviders);
    });
  }, []);

  const handleConnectProvider = async (providerDetail: EIP6963ProviderDetail) => {
    try {
      setError("");
      setConnecting(true);
      const w = await connectProvider(providerDetail);
      onConnect(w);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const handleConnectFallback = async (type: "okx" | "ethereum") => {
    try {
      setError("");
      setConnecting(true);
      const w = await connectFallback(type);
      onConnect(w);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to connect");
    } finally {
      setConnecting(false);
    }
  };

  const hasInjectedOkx = typeof window !== "undefined" && !!(window as any).okxwallet;
  const hasInjectedEth = typeof window !== "undefined" && !!(window as any).ethereum;

  const showOkxFallback = hasInjectedOkx && !providers.some(p => p.info.rdns === "com.okx.wallet");
  const showMetaMaskFallback = hasInjectedEth && !providers.some(p => p.info.rdns === "io.metamask");

  const noWallets = providers.length === 0 && !hasInjectedOkx && !hasInjectedEth;

  return (
    <motion.div
      initial={{ opacity:0 }}
      animate={{ opacity:1 }}
      exit={{ opacity:0 }}
      style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale:0.9, opacity:0 }}
        animate={{ scale:1, opacity:1 }}
        exit={{ scale:0.9, opacity:0 }}
        onClick={e => e.stopPropagation()}
        style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:32, maxWidth:420, width:"90%", position:"relative" }}
      >
        <div style={{ textAlign:"center", marginBottom:24 }}>
          <motion.div
            animate={{ rotate:[0,5,-5,0] }}
            transition={{ duration:3, repeat:Infinity, ease:"easeInOut" }}
            style={{ fontSize:32, color:GOLD, marginBottom:16, display:"inline-block" }}
          >✦</motion.div>
          <h3 className="font-sans" style={{ fontSize:20, fontWeight:700, color:"#f0ead8", marginBottom:8 }}>Connect Wallet</h3>
          <p className="font-display" style={{ fontSize:14, fontStyle:"italic", color:MUTED, lineHeight:1.6 }}>
            Select your wallet to connect to GenStory on GenLayer.
          </p>
        </div>

        {error && (
          <div style={{ background:"#ef444418", border:"1px solid #ef444444", borderRadius:6, padding:"10px 14px", marginBottom:16 }}>
            <span className="font-mono" style={{ fontSize:11, color:"#ef4444" }}>{error}</span>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {providers.map((p) => (
            <motion.div key={p.info.uuid} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleConnectProvider(p)}
                disabled={connecting}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                style={{
                  width: "100%",
                  background: `${CARD}`,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "#f0ead8",
                  cursor: connecting ? "wait" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img
                    src={p.info.icon}
                    alt={p.info.name}
                    style={{ width: 24, height: 24, borderRadius: 4 }}
                  />
                  <span>{p.info.name}</span>
                </div>
                <span style={{ color: GOLD, fontSize: 12, fontWeight: 700 }}>Connect →</span>
              </button>
            </motion.div>
          ))}

          {showOkxFallback && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleConnectFallback("okx")}
                disabled={connecting}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                style={{
                  width: "100%",
                  background: `${CARD}`,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "#f0ead8",
                  cursor: connecting ? "wait" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>🖤</span>
                  <span>OKX Wallet</span>
                </div>
                <span style={{ color: GOLD, fontSize: 12, fontWeight: 700 }}>Connect →</span>
              </button>
            </motion.div>
          )}

          {showMetaMaskFallback && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <button
                onClick={() => handleConnectFallback("ethereum")}
                disabled={connecting}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER; }}
                style={{
                  width: "100%",
                  background: `${CARD}`,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  color: "#f0ead8",
                  cursor: connecting ? "wait" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  transition: "border-color 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>🦊</span>
                  <span>MetaMask / Web3 Wallet</span>
                </div>
                <span style={{ color: GOLD, fontSize: 12, fontWeight: 700 }}>Connect →</span>
              </button>
            </motion.div>
          )}

          {noWallets && (
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <div style={{ background: `${GOLD}0d`, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "20px 16px", marginBottom: 16 }}>
                <p className="font-display" style={{ fontSize: 14, fontStyle: "italic", color: MUTED, lineHeight: 1.7, marginBottom: 12 }}>
                  No compatible Web3 wallets detected in your browser. Install OKX Wallet or MetaMask to proceed.
                </p>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  onClick={() => window.open("https://www.okx.com/web3", "_blank")}
                  style={{
                    flex: 1, background: `linear-gradient(135deg, ${GOLD}, #a07020)`,
                    color: DARK, fontFamily: "'Syne',sans-serif", fontWeight: 700,
                    fontSize: 11, padding: "10px 16px", border: "none",
                  }}
                >
                  OKX Wallet
                </Button>
                <Button
                  onClick={() => window.open("https://metamask.io/download/", "_blank")}
                  style={{
                    flex: 1, background: `${CARD}`, border: `1px solid ${BORDER}`,
                    color: "#f0ead8", fontFamily: "'Syne',sans-serif", fontWeight: 700,
                    fontSize: 11, padding: "10px 16px",
                  }}
                >
                  MetaMask
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="font-mono" style={{ fontSize:9, color:`${MUTED}88`, textTransform:"uppercase", textAlign:"center", marginTop:16, letterSpacing:".04em" }}>
          Supports MetaMask, Rabby, Coinbase Wallet & other EIP-1193 wallets
        </p>

        <button onClick={onClose} style={{ position:"absolute", top:12, right:12, background:"none", border:"none", color:MUTED, fontSize:18, cursor:"pointer" }}>✕</button>
      </motion.div>
    </motion.div>
  );
};

/* ── Navbar ── */
const Nav = ({ wallet, onConnectClick, onDisconnect }: {
  wallet: WalletState | null;
  onConnectClick: () => void;
  onDisconnect: () => void;
}) => {
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
      <div style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer" }} onClick={() => window.scrollTo({ top:0, behavior:"smooth" })}>
        <motion.span
          animate={{ rotate:[0,5,-5,0] }}
          transition={{ duration:4, repeat:Infinity, ease:"easeInOut" }}
          style={{ fontSize:20, color:GOLD }}
        >✦</motion.span>
        <span className="font-sans" style={{ fontSize:14, fontWeight:700, letterSpacing:".08em", color:"#f0ead8" }}>STORY WEAVER</span>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        <Button variant="ghost" onClick={() => scrollTo("features")} style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:MUTED, letterSpacing:".06em" }}>
          Features
        </Button>
        <Button variant="ghost" onClick={() => scrollTo("stories")} style={{ fontFamily:"'Syne',sans-serif", fontSize:12, color:MUTED, letterSpacing:".06em" }}>
          Stories
        </Button>
        {wallet ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span className="font-mono" style={{ fontSize:11, color:GOLD, background:`${GOLD}18`, padding:"4px 10px", borderRadius:6, border:`1px solid ${GOLD}44` }}>
              {wallet.address.slice(0,6)}…{wallet.address.slice(-4)}
            </span>
            <Button variant="ghost" onClick={onDisconnect} style={{ fontFamily:"'Syne',sans-serif", fontSize:11, color:MUTED, padding:"4px 8px" }}>
              ✕
            </Button>
          </div>
        ) : (
          <Button onClick={onConnectClick} style={{
            background:`linear-gradient(135deg, ${GOLD}, #a07020)`,
            color:DARK, fontFamily:"'Syne',sans-serif", fontSize:12,
            fontWeight:700, letterSpacing:".06em", border:"none",
          }}>
            Launch App →
          </Button>
        )}
      </div>
    </motion.nav>
  );
};

/* ── HERO ── */
const Hero = ({ onLaunch }: { onLaunch: () => void }) => {
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
          A collaborative AI storytelling game on Genlayer. Stake tokens, shape your narrative branch, and let the Oracle judge the finest tale.
        </motion.p>

        <motion.div
          initial={{ opacity:0, y:16 }}
          animate={{ opacity:1, y:0 }}
          transition={{ duration:.6, delay:.6 }}
          style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}
        >
          <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:.97 }}>
            <Button size="lg" onClick={onLaunch} style={{
              background:`linear-gradient(135deg, ${GOLD}, #a07020)`,
              color:DARK, fontFamily:"'Syne',sans-serif", fontWeight:800,
              fontSize:13, letterSpacing:".08em", padding:"14px 32px", border:"none",
              boxShadow:`0 0 32px ${GOLD}44`,
            }}>
              ✦ Begin Your Story
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:.97 }}>
            <Button variant="outline" size="lg" onClick={() => scrollTo("stories")} style={{
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
const Stats = ({ stats, loading }: { stats: StatsData; loading: boolean }) => (
  <section style={{ padding:"80px 24px", borderTop:`1px solid ${BORDER}`, borderBottom:`1px solid ${BORDER}` }}>
    <div style={{ maxWidth:800, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:40 }}>
      {loading ? (
        <div style={{ gridColumn:"1 / -1", textAlign:"center" }}>
          <motion.span animate={{ opacity:[0.3,1,0.3] }} transition={{ duration:1.5, repeat:Infinity }}
            className="font-mono" style={{ fontSize:12, color:MUTED }}>Loading from chain…</motion.span>
        </div>
      ) : (
        <>
          <Stat value={stats.totalStories} label="Battles Created" i={0} />
          <Stat value={stats.totalPlayers} label="Active Storytellers" i={1} />
          <Stat value={stats.pot} label="GEN staked in Lobbies" i={2} />
          <Stat value={stats.activeStories} label="Active Now" i={3} />
        </>
      )}
    </div>
  </section>
);

/* ── FEATURES ── */
const Features = () => (
  <section id="features" style={{ padding:"100px 24px" }}>
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

/* ── NETWORK SWITCHER ── */
const NetworkSwitcher = ({ onSwitch }: { onSwitch: () => void }) => {
  const network = getNetwork();
  const networks = getNetworks();
  return (
    <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:24, flexWrap:"wrap" }}>
      {networks.map(n => (
        <motion.button
          key={n.id}
          whileHover={{ scale:1.05 }}
          whileTap={{ scale:0.95 }}
          onClick={() => { setNetwork(n.id); onSwitch(); }}
          style={{
            background: n.id === network.id ? `${GOLD}22` : "transparent",
            border: `1px solid ${n.id === network.id ? GOLD + "66" : BORDER}`,
            borderRadius:6, padding:"6px 16px", cursor:"pointer",
            color: n.id === network.id ? GOLD : MUTED,
            fontFamily:"'Fira Code',monospace", fontSize:11,
            transition:"all .2s",
          }}
        >
          {n.id === network.id && "● "}{n.name}
        </motion.button>
      ))}
    </div>
  );
};

/* ── LIVE STORIES ── */
const LiveStories = ({ stories, loading, onRefresh, onSelectStory, onCreateClick, walletConnected }: {
  stories: StoryItem[];
  loading: boolean;
  onRefresh: () => void;
  onSelectStory: (story: StoryItem) => void;
  onCreateClick: () => void;
  walletConnected: boolean;
}) => (
  <section id="stories" style={{ padding:"100px 24px" }}>
    <div style={{ maxWidth:780, margin:"0 auto" }}>
      <motion.div
        initial={{ opacity:0, y:24 }}
        whileInView={{ opacity:1, y:0 }}
        viewport={{ once:true }}
        style={{ textAlign:"center", marginBottom:32 }}
      >
        <RuneDivider label="— STORY BATTLES —" />
        <h2 className="font-display" style={{ fontSize:"clamp(32px,5vw,52px)", fontWeight:600, marginTop:28 }}>
          Live Battles on the <span style={{ color:GOLD, fontStyle:"italic" }}>Chain</span>
        </h2>
      </motion.div>

      <NetworkSwitcher onSwitch={onRefresh} />

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <span className="font-mono" style={{ fontSize:11, color:MUTED }}>
          {loading ? "Fetching…" : `${stories.length} battles found`}
        </span>
        <div style={{ display:"flex", gap:8 }}>
          {walletConnected && (
            <motion.button
              whileHover={{ scale:1.05 }}
              whileTap={{ scale:0.95 }}
              onClick={onCreateClick}
              style={{
                background:`linear-gradient(135deg, ${GOLD}, #a07020)`,
                color:DARK, border:"none", borderRadius:6,
                padding:"6px 14px", cursor:"pointer",
                fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:700,
              }}
            >
              + Create Battle
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale:1.05 }}
            whileTap={{ scale:0.95 }}
            onClick={onRefresh}
            disabled={loading}
            style={{
              background:"transparent", border:`1px solid ${BORDER}`, borderRadius:6,
              padding:"6px 14px", cursor:"pointer", color:MUTED,
              fontFamily:"'Fira Code',monospace", fontSize:10,
              opacity: loading ? 0.5 : 1,
            }}
          >
            ↻ Refresh
          </motion.button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : stories.length === 0 ? (
        <motion.div
          initial={{ opacity:0 }}
          animate={{ opacity:1 }}
          style={{
            background:CARD, border:`1px solid ${BORDER}`, borderRadius:8,
            padding:"48px 24px", textAlign:"center",
          }}
        >
          <div style={{ fontSize:36, marginBottom:16 }}>📜</div>
          <h3 className="font-sans" style={{ fontSize:16, fontWeight:700, color:"#f0ead8", marginBottom:8 }}>No Battles Active</h3>
          <p className="font-display" style={{ fontSize:14, fontStyle:"italic", color:MUTED, lineHeight:1.7, marginBottom:20 }}>
            The realm awaits its first battle. Plant a seed to begin.
          </p>
          {walletConnected ? (
            <Button onClick={onCreateClick} style={{ background:`linear-gradient(135deg, ${GOLD}, #a07020)`, color:DARK, fontFamily:"'Syne',sans-serif", fontWeight:700 }}>
              + Create First Battle
            </Button>
          ) : (
            <span className="font-mono" style={{ fontSize:11, color:GOLD }}>Connect your wallet above to start a battle</span>
          )}
        </motion.div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          {stories.map((s, i) => <StoryPreview key={s.id} story={s} i={i} onClick={() => onSelectStory(s)} />)}
        </div>
      )}
    </div>
  </section>
);

/* ── CTA ── */
const CTA = ({ onLaunch }: { onLaunch: () => void }) => (
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
        Stake your GEN. Shape your timeline. Let the AI Oracle judge whose story is supreme.
      </p>
      <motion.div whileHover={{ scale:1.04 }} whileTap={{ scale:.97 }} style={{ display:"inline-block" }}>
        <Button size="lg" onClick={onLaunch} style={{
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
const Footer = () => {
  const network = getNetwork();
  return (
    <footer style={{ padding:"32px 24px", borderTop:`1px solid ${BORDER}`, textAlign:"center" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:12 }}>
        <span style={{ fontSize:16, color:GOLD }}>✦</span>
        <span className="font-sans" style={{ fontSize:12, fontWeight:700, letterSpacing:".1em", color:MUTED }}>STORY WEAVER</span>
      </div>
      <p className="font-mono" style={{ fontSize:10, color:MUTED, letterSpacing:".08em", marginBottom:8 }}>
        BUILT ON GENLAYER · COMPETITIVE BRANCHED TIMELINES · ON-CHAIN
      </p>
      <p className="font-mono" style={{ fontSize:9, color:`${MUTED}88`, letterSpacing:".06em" }}>
        Contract: {network.contract} · {network.name}
      </p>
    </footer>
  );
};

/* ── CREATE STORY MODAL ── */
interface CreateStoryModalProps {
  onClose: () => void;
  onSubmit: (seed: string, genre: string, maxChapters: number, stake: number, mode: string) => Promise<void>;
  loading: boolean;
  txMessage: string;
}

const CreateStoryModal = ({ onClose, onSubmit, loading, txMessage }: CreateStoryModalProps) => {
  const [seed, setSeed] = useState("");
  const [genre, setGenre] = useState("fantasy");
  const [maxChapters, setMaxChapters] = useState(10);
  const [stake, setStake] = useState(0);
  const [mode, setMode] = useState("multiplayer"); // "solo" | "multiplayer"

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seed.trim()) return;
    onSubmit(seed, genre, maxChapters, stake, mode);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)" }} onClick={onClose}>
      <motion.div
        initial={{ scale:0.95, opacity:0 }}
        animate={{ scale:1, opacity:1 }}
        exit={{ scale:0.95, opacity:0 }}
        onClick={e => e.stopPropagation()}
        style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:12, padding:32, maxWidth:520, width:"90%", position:"relative", maxHeight:"90vh", overflowY:"auto" }}
      >
        <h3 className="font-sans" style={{ fontSize:22, fontWeight:700, color:"#f0ead8", marginBottom:20 }}>✦ Begin a New Saga</h3>
        
        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div className="drift-particle" style={{ display:"inline-block", fontSize:32, color:GOLD, marginBottom:16, animation:"spin 2s linear infinite" }}>✦</div>
            <p className="font-mono" style={{ fontSize:13, color:GOLD }}>{txMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <div>
              <label className="font-sans" style={{ fontSize:12, fontWeight:700, color:MUTED, display:"block", marginBottom:8, textTransform:"uppercase" }}>Game Mode</label>
              <div style={{ display:"flex", gap:20 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, color:"#e8e2d9", cursor:"pointer", fontSize:14 }}>
                  <input type="radio" name="mode" value="solo" checked={mode === "solo"} onChange={() => setMode("solo")} style={{ accentColor:GOLD }} />
                  Solo Adventure
                </label>
                <label style={{ display:"flex", alignItems:"center", gap:8, color:"#e8e2d9", cursor:"pointer", fontSize:14 }}>
                  <input type="radio" name="mode" value="multiplayer" checked={mode === "multiplayer"} onChange={() => setMode("multiplayer")} style={{ accentColor:GOLD }} />
                  Competitive Battle (2 - 100 Players)
                </label>
              </div>
            </div>

            <div>
              <label className="font-sans" style={{ fontSize:12, fontWeight:700, color:MUTED, display:"block", marginBottom:6, textTransform:"uppercase" }}>Genre</label>
              <select
                value={genre}
                onChange={e => setGenre(e.target.value)}
                style={{ width:"100%", background:DARK, border:`1px solid ${BORDER}`, borderRadius:6, padding:"10px 14px", color:"#e8e2d9", fontFamily:"sans-serif", fontSize:14 }}
              >
                <option value="fantasy">Fantasy</option>
                <option value="sci-fi">Sci-Fi</option>
                <option value="cyberpunk">Cyberpunk</option>
                <option value="horror">Horror</option>
                <option value="mystery">Mystery</option>
              </select>
            </div>

            <div>
              <label className="font-sans" style={{ fontSize:12, fontWeight:700, color:MUTED, display:"block", marginBottom:6, textTransform:"uppercase" }}>Story Seed Prompt</label>
              <textarea
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="A mysterious clock in an abandoned lighthouse starts ticking backwards..."
                required
                rows={3}
                style={{ width:"100%", background:DARK, border:`1px solid ${BORDER}`, borderRadius:6, padding:"10px 14px", color:"#e8e2d9", fontFamily:"sans-serif", fontSize:14, resize:"vertical" }}
              />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
              <div>
                <label className="font-sans" style={{ fontSize:12, fontWeight:700, color:MUTED, display:"block", marginBottom:6, textTransform:"uppercase" }}>Max Chapters</label>
                <input
                  type="number"
                  min={3}
                  max={20}
                  value={maxChapters}
                  onChange={e => setMaxChapters(parseInt(e.target.value) || 10)}
                  style={{ width:"100%", background:DARK, border:`1px solid ${BORDER}`, borderRadius:6, padding:"10px 14px", color:"#e8e2d9", fontFamily:"'Fira Code',monospace", fontSize:14 }}
                />
              </div>
              <div>
                <label className="font-sans" style={{ fontSize:12, fontWeight:700, color:MUTED, display:"block", marginBottom:6, textTransform:"uppercase" }}>Stake (GEN)</label>
                <input
                  type="number"
                  min={0}
                  value={stake}
                  onChange={e => setStake(parseInt(e.target.value) || 0)}
                  style={{ width:"100%", background:DARK, border:`1px solid ${BORDER}`, borderRadius:6, padding:"10px 14px", color:"#e8e2d9", fontFamily:"'Fira Code',monospace", fontSize:14 }}
                />
              </div>
            </div>

            <div style={{ display:"flex", gap:12, justifyContent:"flex-end", marginTop:16 }}>
              <Button type="button" variant="ghost" onClick={onClose} style={{ fontFamily:"'Syne',sans-serif" }}>Cancel</Button>
              <Button type="submit" style={{ background:`linear-gradient(135deg, ${GOLD}, #a07020)`, color:DARK, fontFamily:"'Syne',sans-serif", fontWeight:700 }}>
                Weave & Deploy
              </Button>
            </div>
          </form>
        )}

        <button onClick={onClose} style={{ position:"absolute", top:12, right:12, background:"none", border:"none", color:MUTED, fontSize:18, cursor:"pointer" }}>✕</button>
      </motion.div>
    </div>
  );
};

/* ── STORY DETAILS MODAL ── */
interface StoryDetailsModalProps {
  story: StoryItem;
  onClose: () => void;
  wallet: WalletState | null;
  chapters: StoryChapter[];
  players: StoryPlayer[];
  loadingChapters: boolean;
  loadingPlayers: boolean;
  viewBranch: string;
  onBranchChange: (addr: string) => void;
  onJoin: (stake: number) => Promise<void>;
  onWeave: (action: string) => Promise<void>;
  onEnd: () => Promise<void>;
  actionLoading: boolean;
  txMessage: string;
}

const StoryDetailsModal = ({
  story,
  onClose,
  wallet,
  chapters,
  players,
  loadingChapters,
  loadingPlayers,
  viewBranch,
  onBranchChange,
  onJoin,
  onWeave,
  onEnd,
  actionLoading,
  txMessage
}: StoryDetailsModalProps) => {
  const [activeTab, setActiveTab] = useState<'chapters' | 'players'>('chapters');
  const [stakeInput, setStakeInput] = useState(0);
  const [actionInput, setActionInput] = useState("");

  const isPlayer = wallet ? players.some(p => p.address.toLowerCase() === wallet.address.toLowerCase()) : false;
  const isCreator = wallet ? story.creator?.toLowerCase() === wallet.address.toLowerCase() : false;
  const lastChapter = chapters[chapters.length - 1];
  const suggestions = lastChapter?.suggestions || [];

  // Expiration / Countdown calculation
  const totalDuration = 259200; // 3 days in seconds
  const secondsLeft = story.time_elapsed !== undefined ? Math.max(0, totalDuration - story.time_elapsed) : totalDuration;
  const days = Math.floor(secondsLeft / (24 * 3600));
  const hours = Math.floor((secondsLeft % (24 * 3600)) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);

  const canEnd = story.status === "active" && (isPlayer || isCreator || story.is_expired);
  const isMultiplayer = story.mode === "multiplayer";
  const activeAndLocked = isMultiplayer && players.length < 2 && story.status === "active";

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoin(stakeInput);
  };

  const handleWeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionInput.trim()) return;
    onWeave(actionInput);
    setActionInput("");
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:99, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.8)", backdropFilter:"blur(12px)" }} onClick={onClose}>
      <motion.div
        initial={{ scale:0.97, opacity:0 }}
        animate={{ scale:1, opacity:1 }}
        exit={{ scale:0.97, opacity:0 }}
        onClick={e => e.stopPropagation()}
        style={{
          background:CARD, border:`1px solid ${BORDER}`, borderRadius:12,
          padding:28, maxWidth:680, width:"95%", position:"relative",
          maxHeight:"90vh", display:"flex", flexDirection:"column", gap:20
        }}
      >
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, borderBottom:`1px solid ${BORDER}`, paddingBottom:16 }}>
          <div>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, flexWrap:"wrap" }}>
              <Badge style={{ background:`${GOLD}18`, color:GOLD, border:`1px solid ${GOLD}44`, fontFamily:"'Fira Code',monospace", fontSize:10 }}>{story.genre}</Badge>
              <Badge style={{
                background: story.status === "active" ? "#22c55e18" : story.status === "ended" ? "#3b82f618" : "#ef444418",
                color: story.status === "active" ? "#22c55e" : story.status === "ended" ? "#3b82f6" : "#ef4444",
                border: `1px solid ${story.status === "active" ? "#22c55e44" : story.status === "ended" ? "#3b82f644" : "#ef444444"}`,
                fontFamily:"'Fira Code',monospace", fontSize:10
              }}>{story.status}</Badge>
              
              <Badge style={{
                background: story.mode === "solo" ? `${MUTED}18` : `${GOLD}10`,
                color: story.mode === "solo" ? "#a8a29e" : GOLD2,
                border: `1px solid ${story.mode === "solo" ? BORDER : `${GOLD}33`}`,
                fontFamily:"'Fira Code',monospace", fontSize:9
              }}>
                {story.mode === "solo" ? "Solo Mode" : "Competitive Battle"}
              </Badge>

              {story.status === "active" && (
                <Badge style={{
                  background: story.is_expired ? "#ef444418" : `${MUTED}22`,
                  color: story.is_expired ? "#ef4444" : "#e8e2d9",
                  border: `1px solid ${story.is_expired ? "#ef444444" : BORDER}`,
                  fontFamily:"'Fira Code',monospace", fontSize:9
                }}>
                  {story.is_expired ? "⏱ EXPIRED" : `⏱ ${days}d ${hours}h ${minutes}m left`}
                </Badge>
              )}
            </div>
            <h3 className="font-sans" style={{ fontSize:18, fontWeight:700, color:"#f0ead8" }}>Battle {story.id.replace('story_', '#')}</h3>
            <p className="font-display" style={{ fontSize:14, fontStyle:"italic", color:MUTED, marginTop:4 }}>Seed: "{story.seed}"</p>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div className="font-mono" style={{ fontSize:16, color:GOLD, fontWeight:700 }}>{story.pot} ◈ GEN</div>
            <div className="font-mono" style={{ fontSize:10, color:MUTED, marginTop:4 }}>Creator: {story.creator ? `${story.creator.slice(0,6)}…${story.creator.slice(-4)}` : 'Unknown'}</div>
          </div>
        </div>

        {/* Action Loader */}
        {actionLoading && (
          <div style={{ background:`${GOLD}0d`, border:`1px solid ${GOLD}44`, borderRadius:6, padding:"12px 16px", display:"flex", alignItems:"center", gap:14 }}>
            <span className="font-mono" style={{ fontSize:18, color:GOLD, animation:"spin 2s linear infinite" }}>✦</span>
            <span className="font-mono" style={{ fontSize:11, color:GOLD }}>{txMessage}</span>
          </div>
        )}

        {/* Multiplayer start warning */}
        {activeAndLocked && (
          <div style={{ background:"#e8b84b12", border:"1px solid #e8b84b33", borderRadius:6, padding:"12px 16px" }}>
            <p className="font-display" style={{ fontSize:13, fontStyle:"italic", color:GOLD2, lineHeight:1.5 }}>
              🛡️ <strong>Lobby waiting:</strong> This is a multiplayer battle. At least <strong>2 players</strong> must join before weaving chapters can begin (Current: {players.length}/100 players).
            </p>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex", gap:12, borderBottom:`1px solid ${BORDER}` }}>
          <button
            onClick={() => setActiveTab('chapters')}
            style={{
              background:"transparent", border:"none", borderBottom: activeTab === 'chapters' ? `2px solid ${GOLD}` : "none",
              paddingBottom:8, color: activeTab === 'chapters' ? GOLD : MUTED,
              fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer"
            }}
          >
            Narrative Timelines
          </button>
          <button
            onClick={() => setActiveTab('players')}
            style={{
              background:"transparent", border:"none", borderBottom: activeTab === 'players' ? `2px solid ${GOLD}` : "none",
              paddingBottom:8, color: activeTab === 'players' ? GOLD : MUTED,
              fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer"
            }}
          >
            Players ({players.length}/100)
          </button>
        </div>

        {/* Branch Selector (in Chapters Tab) */}
        {activeTab === 'chapters' && players.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:12, background:`${DARK}88`, padding:"8px 12px", borderRadius:6, border:`1px solid ${BORDER}` }}>
            <span className="font-mono" style={{ fontSize:10, color:MUTED, textTransform:"uppercase" }}>View Story Branch:</span>
            <select
              value={viewBranch}
              onChange={e => onBranchChange(e.target.value)}
              style={{ background:DARK, border:`1px solid ${BORDER}`, borderRadius:4, padding:"4px 8px", color:GOLD, fontSize:11, fontFamily:"'Fira Code',monospace" }}
            >
              {players.map(p => (
                <option key={p.address} value={p.address}>
                  {p.address.toLowerCase() === wallet?.address.toLowerCase() ? "🦊 Your Branch" : `👤 Player-${p.address.slice(0,6)}'s Branch`}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tab Contents */}
        <div style={{ flex:1, overflowY:"auto", minHeight:150 }}>
          {activeTab === 'chapters' ? (
            loadingChapters ? (
              <div style={{ textAlign:"center", padding:20, color:MUTED, fontFamily:"'Fira Code',monospace", fontSize:11 }}>Loading chronicles…</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:16, paddingRight:6 }}>
                {chapters.map((c, idx) => (
                  <div key={idx} style={{ background:DARK, border:`1px solid ${BORDER}`, borderRadius:8, padding:16, position:"relative" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                      <span className="font-mono" style={{ fontSize:10, color:GOLD }}>CHAPTER {c.number}</span>
                      <span className="font-mono" style={{ fontSize:9, color:MUTED }}>By {c.player.slice(0,6)}…{c.player.slice(-4)}</span>
                    </div>
                    {c.number > 0 && (
                      <p className="font-mono" style={{ fontSize:11, color:MUTED, fontStyle:"italic", borderLeft:`2px solid ${BORDER}`, paddingLeft:10, marginBottom:8 }}>
                        Action: "{c.action}"
                      </p>
                    )}
                    <p className="font-display" style={{ fontSize:14, lineHeight:1.7, color:"#e8e2d9", fontStyle:"italic" }}>{c.text}</p>
                  </div>
                ))}
              </div>
            )
          ) : (
            loadingPlayers ? (
              <div style={{ textAlign:"center", padding:20, color:MUTED, fontFamily:"'Fira Code',monospace", fontSize:11 }}>Loading players…</div>
            ) : (
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${BORDER}`, color:MUTED, textAlign:"left" }}>
                    <th className="font-sans" style={{ padding:"8px 0" }}>Address</th>
                    <th className="font-sans" style={{ padding:"8px 0", textAlign:"right" }}>Stake</th>
                    <th className="font-sans" style={{ padding:"8px 0", textAlign:"right" }}>Choices</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom:`1px solid ${BORDER}44` }}>
                      <td className="font-mono" style={{ padding:"10px 0", color: p.address.toLowerCase() === wallet?.address.toLowerCase() ? GOLD : "#e8e2d9" }}>
                        {p.address.slice(0,12)}…{p.address.slice(-6)} {p.address.toLowerCase() === wallet?.address.toLowerCase() && " (You)"}
                      </td>
                      <td className="font-mono" style={{ padding:"10px 0", textAlign:"right" }}>{p.stake} GEN</td>
                      <td className="font-mono" style={{ padding:"10px 0", textAlign:"right" }}>{p.choices_made}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Footer / Interaction Panel */}
        <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:16, marginTop:"auto" }}>
          {!wallet ? (
            <div style={{ textAlign:"center", padding:"10px 0" }}>
              <span className="font-mono" style={{ fontSize:11, color:GOLD }}>Please connect your wallet to participate in the battle.</span>
            </div>
          ) : (
            <>
              {story.status === "active" ? (
                !isPlayer ? (
                  /* Join Story Form */
                  <form onSubmit={handleJoinSubmit} style={{ display:"flex", alignItems:"center", gap:12, justifyContent:"space-between" }}>
                    <div>
                      <p className="font-sans" style={{ fontSize:12, fontWeight:700, color:"#f0ead8" }}>Stake GEN to Join this Battle</p>
                      <p className="font-display" style={{ fontSize:12, color:MUTED, fontStyle:"italic", marginTop:2 }}>Generates your own unique starting branch</p>
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <input
                        type="number"
                        min={0}
                        value={stakeInput}
                        onChange={e => setStakeInput(parseInt(e.target.value) || 0)}
                        style={{ width:80, background:DARK, border:`1px solid ${BORDER}`, borderRadius:6, padding:"8px 10px", color:"#e8e2d9", fontFamily:"'Fira Code',monospace", fontSize:12 }}
                      />
                      <Button type="submit" disabled={actionLoading} style={{ background:`linear-gradient(135deg, ${GOLD}, #a07020)`, color:DARK, fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:11 }}>
                        Join Battle
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* Player Actions Form */
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {/* Render action panel only if branches are active & not expired */}
                    {!story.is_expired && !activeAndLocked && (
                      <>
                        {viewBranch.toLowerCase() === wallet.address.toLowerCase() ? (
                          <>
                            {/* Choices Suggestions */}
                            {suggestions.length > 0 && (
                              <div>
                                <span className="font-sans" style={{ fontSize:10, fontWeight:700, color:MUTED, textTransform:"uppercase", display:"block", marginBottom:6 }}>AI Suggestions for your branch:</span>
                                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                                  {suggestions.map((sug, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setActionInput(sug)}
                                      disabled={actionLoading}
                                      style={{
                                        background:DARK, border:`1px solid ${BORDER}`, borderRadius:6,
                                        padding:"6px 10px", color:GOLD, fontSize:11, fontFamily:"sans-serif",
                                        cursor:"pointer", textAlign:"left", transition:"border-color .2s"
                                      }}
                                      onMouseOver={e => e.currentTarget.style.borderColor = GOLD}
                                      onMouseOut={e => e.currentTarget.style.borderColor = BORDER}
                                    >
                                      {sug}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Submit custom action */}
                            <form onSubmit={handleWeaveSubmit} style={{ display:"flex", gap:8 }}>
                              <input
                                type="text"
                                placeholder="Type your action in plain English (e.g. Open the starlight key)..."
                                value={actionInput}
                                onChange={e => setActionInput(e.target.value)}
                                disabled={actionLoading}
                                required
                                style={{ flex:1, background:DARK, border:`1px solid ${BORDER}`, borderRadius:6, padding:"10px 14px", color:"#e8e2d9", fontSize:12 }}
                              />
                              <Button type="submit" disabled={actionLoading} style={{ background:`linear-gradient(135deg, ${GOLD}, #a07020)`, color:DARK, fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:11 }}>
                                Weave
                              </Button>
                            </form>
                          </>
                        ) : (
                          <div style={{ textAlign:"center", padding:"8px 0", background:`${BORDER}44`, border:`1px solid ${BORDER}`, borderRadius:6 }}>
                            <p className="font-mono" style={{ fontSize:11, color:MUTED }}>
                              💡 Select <strong>"Your Branch"</strong> in the dropdown above to weave your story actions.
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Expiration message */}
                    {story.is_expired && (
                      <div style={{ background:"#ef444410", border:"1px solid #ef444433", borderRadius:6, padding:"10px 14px", textAlign:"center" }}>
                        <p className="font-mono" style={{ fontSize:11, color:"#ef4444" }}>
                          ⏱️ <strong>This battle has expired!</strong> 3-day deadline reached. No more chapters can be added. The pot can now be resolved.
                        </p>
                      </div>
                    )}

                    {/* End Story / Judging triggers */}
                    {canEnd && (
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 }}>
                        <span className="font-mono" style={{ fontSize:9, color:MUTED }}>Your chapters: {chapters.length} / {story.max_chapters || 10}</span>
                        <Button
                          type="button"
                          onClick={onEnd}
                          disabled={actionLoading}
                          style={{
                            background:"transparent", border:`1px solid ${GOLD}`, color:GOLD,
                            fontFamily:"'Syne',sans-serif", fontSize:10, fontWeight:700, padding:"6px 14px",
                            boxShadow: `0 0 12px ${GOLD}33`
                          }}
                        >
                          👑 End & Trigger AI Oracle Judge
                        </Button>
                      </div>
                    )}
                  </div>
                )
              ) : story.status === "ended" ? (
                /* Winner Announcement */
                <div style={{ background:`${GOLD}0d`, border:`1px solid ${GOLD}33`, borderRadius:8, padding:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>🏆</span>
                    <h4 className="font-sans" style={{ fontSize:14, fontWeight:700, color:GOLD }}>Winner Crowned By AI Oracle</h4>
                  </div>
                  <p className="font-mono" style={{ fontSize:11, color:"#f0ead8", background:DARK, padding:"6px 12px", borderRadius:4, border:`1px solid ${BORDER}`, display:"inline-block", marginBottom:10 }}>
                    Winner Address: {story.winner}
                  </p>
                  <p className="font-display" style={{ fontSize:13, fontStyle:"italic", color:"#c8c0b0", lineHeight:1.6 }}>
                    Oracle Verdict: "{story.winner_reason || 'For outstanding narrative choices that resolved the quest.'}"
                  </p>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:"10px 0" }}>
                  <span className="font-mono" style={{ fontSize:11, color:MUTED }}>This battle was cancelled.</span>
                </div>
              )}
            </>
          )}
        </div>

        <button onClick={onClose} style={{ position:"absolute", top:12, right:12, background:"none", border:"none", color:MUTED, fontSize:18, cursor:"pointer" }}>✕</button>
      </motion.div>
    </div>
  );
};

/* ── APP MAIN ── */
export default function App() {
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [stories, setStories] = useState<StoryItem[]>([]);
  const [stats, setStats] = useState<StatsData>({ totalStories:0, activeStories:0, totalPlayers:0, pot:0 });
  const [loadingStories, setLoadingStories] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  // Story detail state
  const [selectedStory, setSelectedStory] = useState<StoryItem | null>(null);
  const [viewBranchAddress, setViewBranchAddress] = useState("");
  const [storyChapters, setStoryChapters] = useState<StoryChapter[]>([]);
  const [storyPlayers, setStoryPlayers] = useState<StoryPlayer[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Write transaction states
  const [showCreateStoryModal, setShowCreateStoryModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [detailActionLoading, setDetailActionLoading] = useState(false);
  const [txMessage, setTxMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoadingStories(true);
    setLoadingStats(true);

    try {
      const result = await fetchStats();
      setStats({
        totalStories: result.totalStories,
        activeStories: result.activeStories,
        totalPlayers: result.totalPlayers,
        pot: result.pot,
      });
      setStories(result.stories as StoryItem[]);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
      try {
        const allStories = await readContract("get_all_stories");
        if (allStories && typeof allStories === "object" && "stories" in allStories) {
          setStories((allStories as { stories: StoryItem[] }).stories);
        }
      } catch {
        console.error("Failed to fetch stories individually");
      }
    }

    setLoadingStories(false);
    setLoadingStats(false);
  }, []);

  // Restore wallet & load data on mount
  useEffect(() => {
    const saved = restoreWallet();
    if (saved) setWallet(saved);
    loadData();
  }, [loadData]);

  // Listen for wallet events
  useEffect(() => {
    const onDisconnect = () => setWallet(null);
    const onChange = (e: Event) => {
      const addr = (e as CustomEvent).detail;
      setWallet(prev => prev ? { ...prev, address: addr } : null);
    };
    window.addEventListener("wallet-disconnected", onDisconnect);
    window.addEventListener("wallet-changed", onChange);
    return () => {
      window.removeEventListener("wallet-disconnected", onDisconnect);
      window.removeEventListener("wallet-changed", onChange);
    };
  }, []);

  // Load details of selected story branch
  const loadStoryDetails = useCallback(async (storyId: string, playerAddress: string) => {
    setLoadingChapters(true);
    setLoadingPlayers(true);

    try {
      const chRes = await readContract("get_chapters", [storyId, playerAddress]);
      if (chRes && typeof chRes === "object" && "chapters" in chRes) {
        setStoryChapters((chRes as { chapters: StoryChapter[] }).chapters);
      }

      const plRes = await readContract("get_players", [storyId]);
      if (plRes && typeof plRes === "object" && "players" in plRes) {
        setStoryPlayers((plRes as { players: StoryPlayer[] }).players);
      }
    } catch (e) {
      console.error("Failed to load details for story branch:", storyId, playerAddress, e);
    } finally {
      setLoadingChapters(false);
      setLoadingPlayers(false);
    }
  }, []);

  const handleSelectStory = async (story: StoryItem) => {
    // Determine initial branch address
    let initialBranch = story.creator || "";
    if (wallet) {
      try {
        const plRes = await readContract("get_players", [story.id]);
        if (plRes && typeof plRes === "object" && "players" in plRes) {
          const playersList = (plRes as { players: StoryPlayer[] }).players;
          const userIsPlayer = playersList.some(p => p.address.toLowerCase() === wallet.address.toLowerCase());
          if (userIsPlayer) {
            initialBranch = wallet.address;
          }
        }
      } catch (e) {
        console.error("Failed to fetch player list on select", e);
      }
    }

    setViewBranchAddress(initialBranch);
    setSelectedStory(story);
    loadStoryDetails(story.id, initialBranch);

    // Fetch full updated story settings
    try {
      const fullStory = await readContract("get_story", [story.id]);
      if (fullStory && typeof fullStory === "object" && "found" in fullStory) {
        setSelectedStory(fullStory as unknown as StoryItem);
      }
    } catch (e) {
      console.error("Failed to fetch full story parameters:", e);
    }
  };

  const handleBranchChange = (addr: string) => {
    if (!selectedStory) return;
    setViewBranchAddress(addr);
    loadStoryDetails(selectedStory.id, addr);
  };

  const handleConnect = (w: WalletState) => {
    setWallet(w);
  };

  const handleDisconnect = () => {
    clearWallet();
    setWallet(null);
  };

  const handleLaunch = () => {
    if (wallet) {
      scrollTo("stories");
    } else {
      setShowWalletModal(true);
    }
  };

  // Transactions
  const handleCreateStorySubmit = async (seed: string, genre: string, maxChapters: number, stake: number, mode: string) => {
    if (!wallet) return;
    setCreateLoading(true);
    setTxMessage("Weaving opening chapter using Gemini AI...");

    try {
      const aiResult = await generateOpeningChapter(genre, seed);
      setTxMessage("Deploying battle lobby to GenLayer blockchain...");

      await writeContract(
        "create_story",
        [seed, aiResult.chapter, JSON.stringify(aiResult.choices), genre, maxChapters, stake, mode],
        wallet.address
      );

      setTxMessage("Waiting 3s for block finalization...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setShowCreateStoryModal(false);
      loadData();
    } catch (e: any) {
      alert("Error creating story: " + (e.message || String(e)));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinSubmit = async (stake: number) => {
    if (!wallet || !selectedStory) return;
    setDetailActionLoading(true);
    setTxMessage("Weaving your own unique opening chapter using Gemini AI...");

    try {
      // Branched join: Generate their own unique first chapter from the same seed
      const aiResult = await generateOpeningChapter(selectedStory.genre, selectedStory.seed);
      setTxMessage("Joining battle on GenLayer...");

      await writeContract(
        "join_story",
        [selectedStory.id, aiResult.chapter, JSON.stringify(aiResult.choices), stake],
        wallet.address
      );

      setTxMessage("Finalizing... loading branch...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      setViewBranchAddress(wallet.address);
      loadStoryDetails(selectedStory.id, wallet.address);
      
      // Update full story
      const fullStory = await readContract("get_story", [selectedStory.id]);
      if (fullStory && typeof fullStory === "object" && "found" in fullStory) {
        setSelectedStory(fullStory as unknown as StoryItem);
      }
      loadData();
    } catch (e: any) {
      alert("Error joining story: " + (e.message || String(e)));
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleWeaveSubmit = async (action: string) => {
    if (!wallet || !selectedStory) return;
    setDetailActionLoading(true);
    setTxMessage("Weaving next chapter with AI Oracle...");

    try {
      // Format the timeline of chapters for this specific player branch
      const formattedChapters = storyChapters.map(c => ({
        text: c.text,
        action: c.action,
        player: c.player
      }));

      const aiResult = await generateNextChapter(selectedStory.genre, formattedChapters, action);
      setTxMessage("Recording chapter on your branch...");

      await writeContract(
        "add_chapter",
        [selectedStory.id, action, aiResult.chapter, JSON.stringify(aiResult.choices)],
        wallet.address
      );

      setTxMessage("Finalizing chapter...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      loadStoryDetails(selectedStory.id, wallet.address);
      loadData();
    } catch (e: any) {
      alert("Error weaving chapter: " + (e.message || String(e)));
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleEndSubmit = async () => {
    if (!wallet || !selectedStory) return;
    setDetailActionLoading(true);
    setTxMessage("AI Judge is loading all players' narrative branches...");

    try {
      // Fetch the full narrative branch for every player in the lobby
      const allBranches = await Promise.all(
        storyPlayers.map(async (p) => {
          const res = await readContract("get_chapters", [selectedStory.id, p.address]);
          const chs = (res as { chapters: StoryChapter[] })?.chapters || [];
          return {
            player: p.address,
            chapters: chs
          };
        })
      );

      setTxMessage("AI Judge is reading all sagas to compare and select the winner...");

      // Format branches for prompt input
      const formattedBranches = allBranches.map(br => {
        const timeline = br.chapters.map(c => `Chapter ${c.number}: ${c.text} (Action: ${c.action})`).join('\n');
        return `Player Address ${br.player}'s story timeline:\n${timeline}`;
      }).join('\n\n');

      // Simple mock formatter of branches to feed the AI Judge
      const judgmentChapters = storyChapters.map(c => ({
        text: `Player Branches submitted:\n${formattedBranches}`,
        player: c.player
      }));

      const formattedPlayers = storyPlayers.map(p => ({
        address: p.address
      }));

      // Trigger AI evaluation
      const judgeResult = await generateJudgeResult(selectedStory.genre, judgmentChapters, formattedPlayers);
      setTxMessage(`Crowning winner: ${judgeResult.winner.slice(0,8)}... on-chain...`);

      await writeContract(
        "end_story",
        [
          selectedStory.id,
          judgeResult.winner,
          judgeResult.reason,
          JSON.stringify(judgeResult.scores),
          JSON.stringify(judgeResult.rating)
        ],
        wallet.address
      );

      setTxMessage("Closing saga...");
      await new Promise(resolve => setTimeout(resolve, 3500));
      
      // Update selected story local state
      const fullStory = await readContract("get_story", [selectedStory.id]);
      if (fullStory && typeof fullStory === "object" && "found" in fullStory) {
        setSelectedStory(fullStory as unknown as StoryItem);
      }
      loadStoryDetails(selectedStory.id, viewBranchAddress);
      loadData();
    } catch (e: any) {
      alert("Error judging story: " + (e.message || String(e)));
    } finally {
      setDetailActionLoading(false);
    }
  };

  return (
    <div className="grain" style={{ minHeight:"100vh", background:DARK }}>
      <FontLoader />
      <Nav wallet={wallet} onConnectClick={() => setShowWalletModal(true)} onDisconnect={handleDisconnect} />
      <Hero onLaunch={handleLaunch} />
      <Stats stats={stats} loading={loadingStats} />
      <Features />
      <HowItWorks />
      
      <LiveStories
        stories={stories}
        loading={loadingStories}
        onRefresh={loadData}
        onSelectStory={handleSelectStory}
        onCreateClick={() => setShowCreateStoryModal(true)}
        walletConnected={!!wallet}
      />
      
      <CTA onLaunch={handleLaunch} />
      <Footer />

      <AnimatePresence>
        {showWalletModal && (
          <WalletModal
            onClose={() => setShowWalletModal(false)}
            onConnect={handleConnect}
          />
        )}

        {showCreateStoryModal && (
          <CreateStoryModal
            onClose={() => setShowCreateStoryModal(false)}
            onSubmit={handleCreateStorySubmit}
            loading={createLoading}
            txMessage={txMessage}
          />
        )}

        {selectedStory && (
          <StoryDetailsModal
            story={selectedStory}
            onClose={() => setSelectedStory(null)}
            wallet={wallet}
            chapters={storyChapters}
            players={storyPlayers}
            loadingChapters={loadingChapters}
            loadingPlayers={loadingPlayers}
            viewBranch={viewBranchAddress}
            onBranchChange={handleBranchChange}
            onJoin={handleJoinSubmit}
            onWeave={handleWeaveSubmit}
            onEnd={handleEndSubmit}
            actionLoading={detailActionLoading}
            txMessage={txMessage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
