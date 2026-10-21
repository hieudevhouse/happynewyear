import { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Clock3, ImagePlus, LoaderCircle, QrCode, RefreshCw, Upload, X } from 'lucide-react';
import { usePlayer } from '../state/PlayerContext';
import { uploadQr } from '../lib/qrUpload';
import { getServerNow } from '../lib/serverClock.js';
import { getWalletDeadline } from '../lib/walletDeadline.js';
import './reward-payout.css';

const methods = [
  { id: 'momo', name: 'MoMo', mark: 'M', hint: 'Quét QR quà tặng' },
  { id: 'zalopay', name: 'ZaloPay', mark: 'Z', hint: 'Quét QR quà tặng' },
  { id: 'bank', name: 'QR ngân hàng', mark: 'QR', hint: 'Gửi QR của bạn' }
];

export default function RewardPayout({ prize }) {
  const { player, saveRedemption, refreshPlayer, statusRefreshError } = usePlayer();
  const redemption = player.redemption;
  const [draftMethod, setMethod] = useState(redemption?.method || 'momo');
  const method = redemption?.method || draftMethod;
  const [recipientQr, setRecipientQr] = useState(redemption?.recipientQr || null);
  const [uploading, setUploading] = useState(false);
  const [uploadPhase, setUploadPhase] = useState('uploading');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);
  const [now, setNow] = useState(getServerNow);
  const fileInput = useRef(null);
  const uploadRequest = useRef(null);
  const mounted = useRef(true);
  const inputId = useId();
  const busy = uploading || saving || refreshing;
  const paid = redemption?.status === 'paid';
  const wallet = method !== 'bank';
  const giftQr = wallet ? prize.payouts?.[method] : null;
  const walletAvailable = wallet && (prize.payoutMethods?.includes(method) || Boolean(giftQr?.url));
  const walletReady = wallet && redemption?.method === method && (redemption.status === 'qr_ready' || paid);
  const deadline = getWalletDeadline(redemption, now);
  const bankSent = method === 'bank' && redemption?.method === 'bank' && redemption.recipientQr?.url === recipientQr?.url;
  const activeMethod = methods.find(item => item.id === redemption?.method);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      uploadRequest.current?.abort();
    };
  }, []);

  useEffect(() => { setImageError(false); }, [method, giftQr?.url]);

  useEffect(() => {
    const tick = () => setNow(getServerNow());
    tick();
    if (!walletReady || paid || !redemption?.qrExpiresAt) return;
    const interval = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [walletReady, paid, redemption?.qrExpiresAt]);

  const chooseMethod = value => {
    if (redemption?.method && redemption.method !== value) return;
    uploadRequest.current?.abort();
    setMethod(value);
    setError('');
  };

  const chooseFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    uploadRequest.current?.abort();
    const controller = new AbortController();
    uploadRequest.current = controller;
    setError('');
    setUploading(true);
    setUploadPhase('uploading');
    try {
      const uploaded = await uploadQr(file, {
        role: 'player', signal: controller.signal,
        onProgress: phase => {
          if (mounted.current && !controller.signal.aborted) setUploadPhase(phase);
        },
      });
      if (mounted.current && !controller.signal.aborted) setRecipientQr(uploaded);
    } catch (failure) {
      if (mounted.current && !controller.signal.aborted) setError(failure.message || 'Chưa tải được ảnh QR. Bạn thử lại nhé.');
    } finally {
      if (mounted.current && uploadRequest.current === controller) setUploading(false);
    }
  };

  const submit = async event => {
    event.preventDefault();
    if (busy || paid) return;
    if (redemption?.method && redemption.method !== method) return;
    if (wallet && !walletAvailable) {
      setError('Người tổ chức chưa đặt QR cho ví này. Bạn có thể chọn ví còn lại hoặc gửi QR ngân hàng.');
      return;
    }
    if (!wallet && !recipientQr?.url) {
      setError('Bạn tải ảnh QR ngân hàng của mình lên trước nhé.');
      fileInput.current?.focus();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveRedemption({ method, recipientQr: wallet ? null : recipientQr });
    } catch (failure) {
      if (mounted.current) setError(failure.message || 'Chưa lưu được cách nhận tiền. Vui lòng thử lại.');
    } finally {
      if (mounted.current) setSaving(false);
    }
  };

  const refreshStatus = async () => {
    if (busy) return;
    setRefreshing(true);
    setError('');
    try {
      const latest = await refreshPlayer();
      if (mounted.current && latest?.redemption) {
        setMethod(latest.redemption.method);
        setRecipientQr(latest.redemption.recipientQr || null);
      }
    } catch (failure) {
      if (mounted.current) setError(failure.message || 'Chưa cập nhật được trạng thái. Bạn thử lại nhé.');
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  };

  return <section className="reward-payout" aria-labelledby={`${inputId}-title`}>
    <div className="reward-payout-heading">
      <span className="reward-payout-symbol" aria-hidden="true"><QrCode size={19}/></span>
      <div>
        <h3 id={`${inputId}-title`}>Nhận tiền lì xì</h3>
        <p>Chọn cách nhận lộc phù hợp với bạn</p>
      </div>
    </div>

    {paid ? <div className="reward-payout-status is-paid" role="status">
      <CheckCircle2 size={22} aria-hidden="true"/>
      <div><strong>Đã chuyển tiền</strong><p>Người tổ chức đã xác nhận gửi lì xì qua {activeMethod?.name || 'phương thức bạn chọn'}.</p></div>
    </div> : <form onSubmit={submit} aria-busy={busy}>
      <fieldset className="reward-methods" disabled={busy}>
        <legend className="lucky-sr-only">Chọn cách nhận tiền lì xì</legend>
        {methods.map(item => <label className={`reward-method${method === item.id ? ' is-selected' : ''}`} key={item.id}>
          <input type="radio" name={`${inputId}-method`} value={item.id} checked={method === item.id} disabled={Boolean(redemption?.method && redemption.method !== item.id)} onChange={() => chooseMethod(item.id)}/>
          <span className={`reward-method-mark is-${item.id}`} aria-hidden="true">{item.mark}</span>
          <span className="reward-method-name">{item.name}</span>
          <span className="reward-method-hint">{item.hint}</span>
          {method === item.id && <CheckCircle2 className="reward-method-check" size={14} aria-hidden="true"/>}
        </label>)}
      </fieldset>
      <p className="reward-method-confirmation" role={redemption ? 'status' : undefined}>{redemption
        ? `Cách nhận đã được xác nhận: ${activeMethod?.name || method}.`
        : 'Bạn có thể đổi cách nhận trước khi xác nhận.'}</p>

      {wallet ? <div className="reward-payout-detail">
        {walletReady && deadline && !deadline.expired && <div className="reward-qr-countdown">
          <Clock3 size={19} aria-hidden="true"/>
          <div><span>Thời gian còn lại</span><strong role="timer" aria-live="off" aria-label={`Còn ${deadline.label}`}>{deadline.label}</strong>
            <small>Hạn xem QR: {new Date(deadline.expiresAt).toLocaleString('vi-VN')}</small></div>
        </div>}
        {walletReady && deadline?.expired ? <div className="reward-payout-unavailable is-expired" role="status">
          <Clock3 size={28} aria-hidden="true"/>
          <strong>Đã hết hạn hiển thị QR</strong>
          <p>Đã đủ 3 ngày kể từ lần đầu mở mã. Vui lòng liên hệ người tổ chức nếu bạn cần hỗ trợ nhận lì xì.</p>
        </div> : walletReady && giftQr?.url ? <>
          <p className="reward-payout-detail-title">QR quà tặng {method === 'momo' ? 'MoMo' : 'ZaloPay'} của người tổ chức</p>
          {imageError ? <p className="reward-payout-error" role="alert">Chưa hiển thị được ảnh QR. Bạn thử mở ảnh bằng nút bên dưới hoặc liên hệ người tổ chức.</p>
            : <figure className="reward-qr-image"><img src={giftQr.url} alt={`Mã QR quà tặng ${method === 'momo' ? 'MoMo' : 'ZaloPay'} của người tổ chức`} onError={() => setImageError(true)}/></figure>}
          <a className="reward-qr-link" href={giftQr.url} target="_blank" rel="noreferrer">Mở ảnh QR để lưu <span className="lucky-sr-only">(mở trong tab mới)</span></a>
          <p className="reward-payout-instructions">Mở {method === 'momo' ? 'MoMo' : 'ZaloPay'} để quét mã này. Nếu dùng cùng điện thoại, hãy lưu ảnh QR rồi chọn ảnh từ thư viện trong ứng dụng.</p>
          <p className="reward-payout-footnote">QR hiển thị trong 72 giờ từ lần mở đầu tiên. Mã đã lưu tuân theo thời hạn trong ứng dụng ví. Trang chưa xác nhận bạn đã nhận tiền trong ví.</p>
        </> : walletReady ? <div className="reward-payout-unavailable" role="status">
          <QrCode size={28} aria-hidden="true"/>
          <strong>Chưa hiển thị được QR đã xác nhận</strong>
          <p>Bạn cập nhật trạng thái bên dưới để tải lại QR, hoặc liên hệ người tổ chức để được hỗ trợ.</p>
        </div> : walletAvailable ? <>
          <div className="reward-payout-placeholder" aria-hidden="true"><QrCode size={36}/><span>Quà Tết đang chờ bạn</span></div>
          <p className="reward-payout-instructions">Người tổ chức đã chuẩn bị QR quà tặng {method === 'momo' ? 'MoMo' : 'ZaloPay'}. Xác nhận để xem mã và nhận lộc qua ví này. Bạn có 3 ngày từ lần đầu hiển thị QR; thời gian không đặt lại khi mở lại. Cách nhận sẽ được giữ cho phần lì xì của bạn.</p>
          <button type="submit" className="reward-payout-submit" disabled={busy}>{saving ? <><LoaderCircle size={17} className="reward-payout-spinner" aria-hidden="true"/> Đang xác nhận…</> : <><QrCode size={17} aria-hidden="true"/> Xác nhận nhận qua {method === 'momo' ? 'MoMo' : 'ZaloPay'}</>}</button>
        </> : <div className="reward-payout-unavailable" role="status">
          <QrCode size={28} aria-hidden="true"/>
          <strong>QR {method === 'momo' ? 'MoMo' : 'ZaloPay'} chưa được đặt</strong>
          <p>{redemption ? 'Vui lòng liên hệ người tổ chức để được hỗ trợ mã QR cho cách nhận đã xác nhận.' : 'Bạn có thể chọn ví còn lại hoặc tải QR ngân hàng của mình để người tổ chức chuyển tiền.'}</p>
          {!redemption && <button type="button" className="reward-payout-secondary" onClick={() => chooseMethod('bank')}>Dùng QR ngân hàng</button>}
        </div>}
      </div> : <div className="reward-payout-detail">
        <p className="reward-payout-detail-title">Gửi mã QR ngân hàng của bạn</p>
        <p className="reward-payout-instructions">Không dùng MoMo hoặc ZaloPay? Tải QR nhận tiền từ ứng dụng ngân hàng của bạn. Người tổ chức sẽ chuyển tiền theo mã này.</p>
        <input id={inputId} className="lucky-sr-only" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} disabled={busy} aria-label="Tải ảnh mã QR ngân hàng của bạn" aria-describedby={`${inputId}-file-help`}/>
        {recipientQr?.url ? <div className="reward-bank-preview">
          <figure className="reward-qr-image"><img src={recipientQr.url} alt="Mã QR ngân hàng bạn đã tải lên"/></figure>
          <div className="reward-bank-actions">
            <button className="reward-payout-secondary" type="button" onClick={() => fileInput.current?.click()} disabled={busy}><ImagePlus size={15} aria-hidden="true"/> Đổi ảnh QR</button>
            {!bankSent && <button className="reward-payout-remove" type="button" onClick={() => { setRecipientQr(null); setError(''); }} disabled={busy}><X size={15} aria-hidden="true"/> Bỏ ảnh</button>}
          </div>
        </div> : <button className="reward-upload-dropzone" type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
          {uploading ? <LoaderCircle className="reward-payout-spinner" size={28} aria-hidden="true"/> : <Upload size={28} aria-hidden="true"/>}
          <strong>{uploading ? (uploadPhase === 'preparing' ? 'Đang tối ưu ảnh QR…' : 'Đang tải ảnh lên…') : 'Chọn ảnh QR ngân hàng'}</strong>
          <span>Ảnh rõ nét, đầy đủ mã QR</span>
        </button>}
        <p className="reward-payout-file-help" id={`${inputId}-file-help`}>JPG, PNG hoặc WebP, tối đa 50 MB. Ảnh lớn được tự động tối ưu trước khi tải. Kiểm tra đúng ngân hàng và tài khoản trước khi gửi.</p>
        {uploading && recipientQr?.url && <p className="reward-payout-upload-status" role="status"><LoaderCircle className="reward-payout-spinner" size={15} aria-hidden="true"/> {uploadPhase === 'preparing' ? 'Đang tối ưu ảnh QR…' : 'Đang tải ảnh mới…'}</p>}
        {recipientQr?.url && !uploading && <div className="reward-payout-status" role="status"><Clock3 size={20} aria-hidden="true"/><div><strong>Chưa chuyển tiền</strong><p>{bankSent ? 'Đã gửi QR cho người tổ chức. Trạng thái tự cập nhật khi người tổ chức xác nhận đã chuyển tiền. Bạn có thể đổi ảnh nếu cần.' : 'Ảnh đã tải lên. Bấm xác nhận bên dưới để gửi QR cho người tổ chức chuyển tiền.'}</p></div></div>}
        {!bankSent && <button className="reward-payout-submit" type="submit" disabled={busy || !recipientQr?.url}>{saving ? <><LoaderCircle size={17} className="reward-payout-spinner" aria-hidden="true"/> Đang gửi…</> : <><Upload size={17} aria-hidden="true"/> {redemption ? 'Gửi QR cập nhật' : 'Xác nhận và gửi QR'}</>}</button>}
      </div>}
      {redemption && typeof refreshPlayer === 'function' && <button type="button" className="reward-payout-refresh" onClick={refreshStatus} disabled={busy}>
        <RefreshCw size={14} className={refreshing ? 'reward-payout-spinner' : ''} aria-hidden="true"/>{refreshing ? 'Đang cập nhật…' : 'Cập nhật trạng thái'}
      </button>}
      {error && <p className="reward-payout-error" role="alert">{error}</p>}
      {!error && bankSent && statusRefreshError && <p className="reward-payout-error" role="status">{statusRefreshError} Bạn có thể bấm cập nhật trạng thái để thử lại.</p>}
    </form>}
  </section>;
}
