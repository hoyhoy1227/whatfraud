import AppIcon from './app-icon';

type LoadingVariant = 'startup' | 'case';

type GameLoadingScreenProps = {
  variant: LoadingVariant;
  progress: number;
};

export default function GameLoadingScreen({ variant, progress }: GameLoadingScreenProps) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <main className={`game-loading-screen loading-${variant}`} aria-busy="true">
      <section className="loading-device" role="status" aria-label="잠시 기다려 주세요">
        <div className="loading-device-status" aria-hidden="true"><b>08:20</b><span>SIM · Wi-Fi ▮▮▮</span></div>
        <div className={`loading-device-content native-loading-${variant}`}>
          {variant === 'startup' ? (
            <div className="native-app-launch" aria-hidden="true">
              <div className="loading-app-mark"><span>24</span></div>
              <strong>수익률 24시</strong>
              <i className="native-loading-spinner" />
            </div>
          ) : (
            <>
              <div className="loading-lock-clock" aria-hidden="true"><time>08:20</time><span>8월 29일 토요일</span></div>
              <i className="native-loading-spinner" aria-hidden="true" />
            </>
          )}
          {variant === 'case' && safeProgress >= 82 && (
            <div className="loading-message-preview" aria-hidden="true">
              <AppIcon name="messages" size="mini" />
              <span><b>메시지</b><small>새 알림이 도착했습니다.</small></span>
              <em>지금</em>
            </div>
          )}
          <progress className="native-loading-progress" role="progressbar" aria-label="로딩 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress} max={100} value={safeProgress}>잠시 기다려 주세요</progress>
        </div>
        <div className="loading-device-gesture" aria-hidden="true" />
      </section>
    </main>
  );
}
