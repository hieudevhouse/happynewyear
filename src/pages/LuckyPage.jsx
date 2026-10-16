import { useCallback, useState } from 'react';
import { Navigate } from 'react-router-dom';
import PeachTree from '../components/PeachTree';
import RewardDialog from '../components/RewardDialog';
import { usePlayer } from '../state/PlayerContext';
import { getPlayerReward } from '../state/playerSession';

export default function LuckyPage() {
  const { player, receive } = usePlayer();
  const [reward, setReward] = useState(null);
  const closeReward = useCallback(() => setReward(null), []);
  if (!player.code) return <Navigate to="/" replace/>;
  if (!player.name) return <Navigate to="/info" replace/>;

  const received = [...player.opened].reverse().map(index => getPlayerReward(player, index));
  const reveal = index => {
    receive(index);
    setReward({ ...getPlayerReward(player, index), fresh: true });
  };

  return <main className="lucky-page">
    <h1 className="lucky-sr-only">Cây đào nhận lì xì</h1>
    <div className="lucky-tree-area">
      <PeachTree opened={player.opened} onOpened={reveal} disabled={reward !== null}/>
    </div>
    {received.length > 0 && <aside className="lucky-rewards" aria-label="Lì xì bạn đã mở">
      <div className="lucky-rewards-label">Lộc đã nhận <span>{received.length}/16</span></div>
      <div className="lucky-rewards-list">
        {received.map(item => <button type="button" className="lucky-reward-item" key={item.index}
          onClick={() => setReward(item)} aria-label={`Xem lại bao số ${item.number}: ${item.prize.title}`}>
          <span className="lucky-reward-icon" aria-hidden="true">{item.prize.icon}</span>
          <span><small>BAO {String(item.number).padStart(2, '0')}</small><strong>{item.prize.title}</strong></span>
        </button>)}
      </div>
    </aside>}
    {reward && <RewardDialog reward={reward} onClose={closeReward} autoReturn={Boolean(reward.fresh)}/>}
  </main>;
}
