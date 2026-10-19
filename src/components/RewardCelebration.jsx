import './reward-celebration.css';

const particles = Array.from({ length: 20 }, (_, index) => {
  const angle = index * 137.5 * Math.PI / 180;
  const radius = 2 + index % 5 * .85;
  return {
    left: Math.cos(angle) * radius,
    top: Math.sin(angle) * radius * .35,
    drift: Math.cos(angle) * (1.5 + index % 4),
    rise: 3 + index % 6 * .6,
    delay: .2 + index % 7 * .075,
    duration: 1.8 + index % 4 * .2,
    turn: index % 2 ? 110 : -100
  };
});

export default function RewardCelebration() {
  return <div className="reward-celebration" aria-hidden="true">
    <div className="reward-celebration-bloom"/>
    <div className="reward-celebration-ring"/>
    <div className="reward-celebration-rays">
      {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--ray-angle': `${index * 30}deg` }}/>) }
    </div>
    {particles.map((particle, index) => <i key={index}
      className={`reward-celebration-particle ${index % 3 === 0 ? 'is-petal' : 'is-sparkle'}`}
      style={{
        '--particle-left': `${particle.left}rem`, '--particle-top': `${particle.top}rem`,
        '--particle-drift': `${particle.drift}rem`, '--particle-rise': `${-particle.rise}rem`,
        '--particle-delay': `${particle.delay}s`, '--particle-duration': `${particle.duration}s`,
        '--particle-turn': `${particle.turn}deg`
      }}/>) }
  </div>;
}
