import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { ENVELOPE_ANCHORS, ENVELOPE_STYLES, mountPeachTree, seededRandom } from './peachTreeScene';
import './peach-tree.css';

// A lightweight illustrated tree keeps the same interaction available without WebGL.
function IllustratedTree() {
  const random = seededRandom(58);
  const clusters = [[-4.15, 1.6], [-3.9, 2.6], [-3, 3.2], [-1.9, 3.6], [-.8, 4.1],
    [.45, 4.45], [1.55, 4.05], [2.65, 3.5], [3.75, 2.85], [4.25, 1.8],
    [3.1, 1.2], [1.9, 2.25], [.65, 2.9], [-.9, 2.75], [-2.35, 1.9], [-3.15, .7],
    [-3.7, -.25], [3.65, -.2], [-1.55, .8], [1.55, .95]];
  const flowers = clusters.flatMap(([x, y], cluster) => Array.from({ length: 28 }, () => {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    return {
      x: x + Math.cos(angle) * radius * .78, y: y + Math.sin(angle) * radius * .58,
      size: .065 + random() * .055, angle: random() * 360,
      color: ['#ee4777', '#f978a0', '#ffb2c8', '#dc365e', '#ffd3df'][(cluster + Math.floor(random() * 5)) % 5]
    };
  }));
  const branches = [
    ['M-.3-.65 C-1.1.05-2.2.1-3.1.65 S-4.1 1.6-4.65 1.9', .43],
    ['M-.05.65 C-1.1 1.6-2.45 2.2-3.75 2.8', .37],
    ['M.3 1.8 C-.5 2.7-1.5 3.25-2.7 3.65', .27],
    ['M.45.35 C1.4.8 2 1.8 3.25 2.45 S4.2 2.7 4.6 3.2', .39],
    ['M.2-.8 C1.4-.15 2.5-.1 3.6.65 S4.15 1.4 4.6 1.7', .4],
    ['M.6 1.8 C1.3 2.6 1.6 3.55 2.5 3.9', .25],
    ['M-2.1.25 C-3.2.1-3.6-.55-3.75-1.35', .12],
    ['M2.8.2 C3.6-.1 3.7-.7 3.65-1.4', .12],
    ['M-2.2 2.1 C-2.4 2.9-2.2 3.1-1.75 3.75', .13],
    ['M2.1 1.65 C2.8 1.6 3.5 1.4 4.15 1.6', .12]
  ];
  return <svg className="peach-tree-illustration" viewBox="-5.75 -5.35 11.5 9.8" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <linearGradient id="peach-bark" x1="0" x2="1"><stop stopColor="#422b22"/><stop offset=".3" stopColor="#79503a"/><stop offset=".58" stopColor="#b78153"/><stop offset=".8" stopColor="#69432f"/><stop offset="1" stopColor="#3f2c24"/></linearGradient>
      <linearGradient id="peach-meadow" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#368b43"/><stop offset=".55" stopColor="#64b44d"/><stop offset="1" stopColor="#98d66b"/></linearGradient>
      <linearGradient id="peach-distant-meadow" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#79c985"/><stop offset="1" stopColor="#b1e5a0"/></linearGradient>
    </defs>
    <g transform="scale(1,-1)">
      <g fill="#fff" opacity=".65">
        <ellipse cx="-4.4" cy="4.3" rx="1.3" ry=".2"/><ellipse cx="-3.8" cy="4.45" rx=".65" ry=".22"/>
        <ellipse cx="4.7" cy="4.55" rx="1.5" ry=".18"/>
      </g>
      <path d="M-7-2.65 Q-4-1.8-.5-2.75 Q3-1.85 7-2.65 L7-5.5 L-7-5.5Z" fill="url(#peach-distant-meadow)"/>
      <path d="M-7-3.35 Q-4-2.75-.4-3.15 Q3-2.7 7-3.2 L7-5.5 L-7-5.5Z" fill="url(#peach-meadow)"/>
      <ellipse cx=".4" cy="-3.48" rx="3.7" ry=".44" fill="#245e32" opacity=".2"/>
      <g fill="none" stroke="url(#peach-bark)" strokeLinecap="round">
        {branches.map(([d, width]) => <path key={d} d={d} strokeWidth={width}/>)}
        {flowers.filter((_, i) => i % 9 === 0).map((p, i) => <path key={i} d={`M${p.x * .75} ${p.y * .76} Q${p.x - .14} ${p.y - .36} ${p.x} ${p.y}`} strokeWidth=".028"/>)}
        <path d="M.4 2.4 Q.15 3.3.65 4.5 M-3.2 2.5 Q-3.8 3.1-4.35 3.2 M-3.4.9 Q-4.15 1.1-4.7.8 M3.55 2.6 Q3.9 3.3 3.65 3.55" strokeWidth=".075"/>
      </g>
      <path d="M-1.35-3.52 Q-.65-3.07-.65-2.7 C-.78-2.02-.72-1.32-.48-.68 C-.15.06.14.73.04 1.45 C-.06 2.12.26 2.78.84 3.43 L.98 3.48 C.56 2.57.53 2.10.67 1.45 C.81.64.43-.10.20-.75 C.03-1.41.12-2.37.52-2.99 L1.33-3.57 L.31-3.37 L-.14-3.61 L-.51-3.40Z" fill="url(#peach-bark)"/>
      <g fill="none" strokeLinecap="round">
        <path d="M-.38-3.3 C-.65-2.2-.40-1.2-.12-.65 S.5.6.32 1.55 Q.18 2.3.7 3.1" stroke="#d09b67" strokeWidth=".065" opacity=".75"/>
        <path d="M-.07-3.36 C-.4-2.25-.15-1.1.08-.57 M-.5-2.8 Q-.27-2.6-.35-2.1 M.33 1.1 Q.5 1.4.34 1.8" stroke="#452d24" strokeWidth=".045" opacity=".8"/>
        <path d="M-.53-2.9 Q-1.15-3.3-2.1-3.45 M.05-2.95 Q.75-3.4 2.05-3.48 M-.1-3.13 Q-.55-3.56-.8-3.65" stroke="url(#peach-bark)" strokeWidth=".17"/>
      </g>
      {flowers.map((p, i) => <g key={i} transform={`translate(${p.x},${p.y}) rotate(${p.angle})`}>
        {i % 4 === 0 && <ellipse cx=".12" cy="-.1" rx=".035" ry=".14" fill="#60a64b" transform="rotate(-35)"/>}
        {Array.from({ length: 5 }, (_, k) => <ellipse key={k} cy={p.size * .62} rx={p.size * .58} ry={p.size} transform={`rotate(${k * 72})`} fill={p.color}/>)}
        <circle r=".022" fill="#ffe4a3"/>
      </g>)}
      {Array.from({ length: 160 }, (_, i) => {
        const x = (random() - .5) * 12;
        const y = -3.15 - random() * 1.5;
        return <path key={`grass-${i}`} d={`M${x} ${y} q-.05 .13 -.09 .18 M${x} ${y} q.02 .2 .1 .28`} fill="none" stroke={i % 3 ? '#498b3b' : '#b4df6b'} strokeWidth=".014" opacity=".7"/>;
      })}
      {Array.from({ length: 110 }, (_, i) => <ellipse key={`ground-${i}`} cx={(random() - .5) * 10.5}
        cy={-3.25 - random() * 1.15} rx=".022" ry=".04" fill={i % 3 ? '#ffacc3' : '#e5527a'}/>)}
      {flowers.filter((p, i) => p.y > .6 && i % 7 === 0).map((p, i) => <g key={`fall-${i}`} transform={`translate(${p.x},${p.y})`}>
        <g className="peach-illustrated-falling" style={{
          '--petal-x': `${.5 + i % 5 * .2}px`, '--petal-y': `${-3.5 - p.y}px`,
          animationDuration: `${7 + i % 6}s`, animationDelay: `${-i * 1.7}s`
        }}><path d="M0-.08 Q-.09 0-.04.09 Q0 .13.06.07 Q.1 0 0-.08" fill="#ffc1d1"/></g>
      </g>)}
    </g>
  </svg>;
}

export default function PeachTree({ opened = [], onOpened, disabled = false }) {
  const [opening, setOpening] = useState(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const host = useRef(null);
  const buttons = useRef([]);
  const scene = useRef(null);
  const locked = useRef(false);
  const confirming = useRef(false);
  const mounted = useRef(false);
  const confirmedOpened = useRef(opened);
  confirmedOpened.current = opened;
  const pending = useRef(null);
  const fallbackTimer = useRef(null);
  const reveal = useRef(onOpened);
  reveal.current = onOpened;
  const finish = useRef(null);
  finish.current = async index => {
    if (!locked.current || confirming.current) return;
    confirming.current = true;
    try {
      await reveal.current(index);
    } catch {
      // The server is authoritative: put an unconfirmed packet back for a retry.
      scene.current?.setOpened(confirmedOpened.current);
    } finally {
      confirming.current = false;
      locked.current = false;
      pending.current = null;
      if (mounted.current) setOpening(null);
    }
  };

  useEffect(() => {
    mounted.current = true;
    let active = true;
    scene.current = mountPeachTree(host.current, buttons.current, {
      opened,
      onReady: () => { if (active) setReady(true); },
      onError: () => { if (active) { setFallback(true); setReady(true); } },
      onOpened: index => { if (active) finish.current(index); }
    });
    return () => {
      active = false;
      mounted.current = false;
      clearTimeout(fallbackTimer.current);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);

  useEffect(() => { scene.current?.setOpened(opened); }, [opened]);

  useEffect(() => {
    if (!fallback) return;
    scene.current?.dispose();
    scene.current = null;
    if (locked.current && !confirming.current && pending.current !== null) {
      const index = pending.current;
      fallbackTimer.current = setTimeout(() => finish.current(index), 1100);
    }
  }, [fallback]);

  const open = index => {
    if (!ready || disabled || locked.current || opened.length > 0) return;
    locked.current = true;
    pending.current = index;
    if (scene.current && !scene.current.open(index)) {
      locked.current = false;
      pending.current = null;
      return;
    }
    setOpening(index);
    if (!scene.current) fallbackTimer.current = setTimeout(() => finish.current(index), 1400);
  };

  return <section className={`peach-tree-card${opening !== null ? ' is-opening' : ''}`} aria-label="Cây đào treo lì xì">
    <div className={`peach-garden${ready ? ' is-ready' : ''}${fallback ? ' is-illustrated' : ''}`} aria-busy={!ready || opening !== null}>
      <div className="peach-garden-grain" aria-hidden="true"/>
      <div className="peach-tree-canvas" ref={host}/>
      {fallback && <IllustratedTree/>}
      <div className="peach-envelope-targets" role="group" aria-label={opened.length > 0 ? 'Mã này đã nhận một phần quà' : 'Chọn một bao lì xì duy nhất để nhận quà'}>
        {ENVELOPE_ANCHORS.map((anchor, index) => {
          const style = ENVELOPE_STYLES[index % ENVELOPE_STYLES.length];
          return <button key={index} ref={element => { buttons.current[index] = element; }} type="button"
            className={`peach-envelope-hit${opening === index ? ' is-selected' : ''}`}
            onClick={() => open(index)} disabled={disabled || opening !== null || !ready || opened.length > 0}
            hidden={opened.includes(index) || (opening !== null && (!fallback || opening !== index))}
            aria-label={`Mở bao lì xì số ${index + 1}, họa tiết ${style.name}`}
            style={fallback ? {
              left: `${(anchor[0] + 5.75) / 11.5 * 100}%`,
              top: `${(5.35 - anchor[1] + .66) / 9.8 * 100}%`,
              transform: 'translate(-50%, -50%)', visibility: 'visible',
              '--packet-color': style.color, '--packet-gold': style.gold
            } : undefined}>
            {fallback && <i className="peach-illustrated-packet" aria-hidden="true"><em>{style.symbol}</em></i>}
          </button>;
        })}
      </div>
      {!ready && <div className="peach-tree-loading" role="status"><Sparkles size={24}/><span className="lucky-sr-only">Đang tải cây đào</span></div>}
      <span className="lucky-sr-only" role="status" aria-live="polite">{opening !== null ? 'Đang mở lì xì…' : ''}</span>
    </div>
  </section>;
}
