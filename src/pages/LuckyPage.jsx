import { useCallback, useRef, useState } from 'react';
import { ArrowUpRight, Check, Clock3, Gift, LockKeyhole, Sparkles } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import PeachTree from '../components/PeachTree';
import RewardDialog from '../components/RewardDialog';
import { usePlayer } from '../state/PlayerContext';
import { getPlayerReward } from '../state/playerSession';
import { useFestiveAudio } from '../state/FestiveAudioContext';

export default function LuckyPage() {
  const { player, receive, loading, sessionError, retrySession } = usePlayer();
  const { playOpening, playReward } = useFestiveAudio();
  const [reward, setReward] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const claiming = useRef(false);
  const rewardCard = useRef(null);
  const closeReward = useCallback(() => {
    setReward(null);
    requestAnimationFrame(() => rewardCard.current?.focus({ preventScroll: true }));
  }, []);
  if (loading) return <main className="lucky-page"><div className="player-api-status" role="status">Đang khôi phục lượt nhận lộc…</div></main>;
  if (sessionError) return <main className="lucky-page"><div className="player-api-status" role="alert"><p>{sessionError}</p>
    <button className="primary-btn" type="button" onClick={retrySession}>Kết nối lại</button>
  </div></main>;
  if (!player.code) return <Navigate to="/" replace/>;
  if (!player.name) return <Navigate to="/info" replace/>;

  const received = player.opened.map(index => getPlayerReward(player, index)).find(Boolean)
    || player.rewards?.map(item => getPlayerReward(player, item.index)).find(Boolean)
    || null;
  const used = player.status === 'used' || player.opened.length > 0 || Boolean(received);
  const bankPending = player.redemption?.method === 'bank' && player.redemption.status === 'pending';
  const payoutStatus = player.redemption?.status === 'paid' ? 'Đã chuyển tiền' : bankPending ? 'Chưa chuyển tiền' : 'Đã mở lì xì';
  const PrizeCard = received ? 'button' : 'div';

  const reveal = async index => {
    if (claiming.current || used) {
      const failure = new Error('Mã này chỉ được nhận một phần quà.');
      setError(failure.message);
      throw failure;
    }
    claiming.current = true;
    setError('');
    setPending(true);
    try {
      const awarded = await receive(index);
      playReward();
      setReward(awarded);
    } catch (failure) {
      const recovered = failure.details?.player;
      const alreadyUsed = recovered && (recovered.status === 'used' || recovered.opened?.length > 0 || recovered.rewards?.length > 0);
      setError(alreadyUsed
        ? 'Mã này đã nhận lộc. Mỗi mã chỉ được nhận một phần quà.'
        : `${failure.message || 'Chưa nhận được kết quả từ máy chủ.'} Chạm lại bao lì xì để thử lại.`);
      throw failure;
    } finally {
      claiming.current = false;
      setPending(false);
    }
  };

  return <main className="lucky-page">
    <h1 className="lucky-sr-only">Cây đào nhận lì xì — mỗi mã một phần quà</h1>
    <div className="lucky-tree-area">
      <PeachTree opened={player.opened} onOpening={playOpening} onOpened={reveal} disabled={used || reward !== null || pending}/>
    </div>
    <aside className={`lucky-prize-slot${used ? ' is-complete' : ''}`} aria-labelledby="lucky-prize-heading">
      <div className="lucky-prize-topline">
        <h2 id="lucky-prize-heading">Lộc xuân của bạn</h2>
        <span className="lucky-prize-status">
          {bankPending ? <Clock3 size={12} aria-hidden="true"/> : used ? <Check size={12} aria-hidden="true"/> : <Sparkles size={12} aria-hidden="true"/>}
          {used ? payoutStatus : '1 mã · 1 phần quà'}
        </span>
      </div>
      <PrizeCard className="lucky-prize-card" ref={rewardCard}
        type={received ? 'button' : undefined}
        onClick={received ? () => setReward(received) : undefined}
        aria-haspopup={received ? 'dialog' : undefined}
        aria-label={received ? `Xem lại phần quà: ${received.prize.title}` : undefined}>
        <span className="lucky-prize-emblem" aria-hidden="true">
          {received ? received.prize.icon : used ? <LockKeyhole size={26}/> : <Gift size={28} strokeWidth={1.5}/>}
        </span>
        <span className="lucky-prize-copy">
          <span className="lucky-prize-eyebrow">{received ? `BAO LÌ XÌ SỐ ${String(received.number).padStart(2, '0')}` : used ? 'LƯỢT NHẬN ĐÃ HOÀN TẤT' : 'MỘT LỰA CHỌN · MỘT NIỀM VUI'}</span>
          <span className="lucky-prize-title">{received ? received.prize.title : used ? 'Mã này đã nhận lộc' : 'Một món quà đang chờ bạn'}</span>
          {received?.prize.amount > 0 && <span className="lucky-prize-cash">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(received.prize.amount)}</span>}
          <span className="lucky-prize-description">{received ? 'Quà đã được lưu. Chạm để xem lại.' : used ? 'Chưa có thông tin phần quà để hiển thị. Vui lòng liên hệ người tổ chức.' : 'Chọn một bao lì xì trên cây để mở lộc đầu xuân.'}</span>
        </span>
        {received && <span className="lucky-prize-view" aria-hidden="true"><ArrowUpRight size={20}/></span>}
      </PrizeCard>
      <p className={`lucky-prize-note${error ? ' has-error' : ''}`} role={error ? 'alert' : 'status'} aria-live="polite">
        {pending ? 'Đang nhận lộc từ máy chủ…' : error || (used ? 'Mỗi mã chỉ nhận một phần quà. Chúc bạn một năm an vui!' : 'Mỗi mã chỉ mở được một bao. Hãy chọn bao bạn yêu thích!')}
      </p>
    </aside>
    {reward && <RewardDialog reward={getPlayerReward(player, reward.index) || reward} onClose={closeReward}/>}
  </main>;
}
