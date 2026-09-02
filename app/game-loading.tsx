type LoadingVariant = 'startup' | 'case';

type GameLoadingScreenProps = {
  variant: LoadingVariant;
  progress: number;
  eyebrow: string;
  title: string;
  detail: string;
  steps: string[];
};

export default function GameLoadingScreen({ variant, progress, eyebrow, title, detail, steps }: GameLoadingScreenProps) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const activeStep = Math.min(steps.length - 1, Math.floor((safeProgress / 100) * steps.length));

  return (
    <main className={`game-loading-screen loading-${variant}`} aria-busy="true" aria-live="polite">
      <section className="loading-device" role="status" aria-label={`${title} ${safeProgress}%`}>
        <div className="loading-device-status" aria-hidden="true"><b>08:20</b><span>SIM · Wi-Fi ▮▮▮</span></div>
        <div className="loading-device-content">
          <div className={`loading-app-mark ${variant === 'case' ? 'is-message' : ''}`} aria-hidden="true">
            {variant === 'startup' ? <span>24</span> : <i className="mini-icon icon-messages" />}
          </div>
          <span className="pixel-label">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{detail}</p>
          {variant === 'case' && (
            <div className="loading-message-preview" aria-hidden="true">
              <i className="mini-icon icon-messages" />
              <span><b>메시지</b><small>{safeProgress === 100 ? '새 연락이 도착했습니다.' : '새로운 연락을 수신하고 있습니다.'}</small></span>
              <em>지금</em>
            </div>
          )}
          <div
            className="game-loading-progress"
            role="progressbar"
            aria-label="게임 준비 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={safeProgress}
          >
            <i style={{ width: `${safeProgress}%` }} />
          </div>
          <div className="loading-progress-copy"><b>{safeProgress}%</b><span>{safeProgress === 100 ? '완료' : '준비 중'}</span></div>
          <ol className="loading-steps" aria-label="준비 단계">
            {steps.map((step, index) => (
              <li key={step} className={index < activeStep || safeProgress === 100 ? 'done' : index === activeStep ? 'active' : ''}>
                <i>{index < activeStep || safeProgress === 100 ? '✓' : index + 1}</i><span>{step}</span>
              </li>
            ))}
          </ol>
          <small>{variant === 'startup' ? 'AI 연결은 화면을 연 뒤 백그라운드에서 확인합니다.' : '판정을 마칠 때마다 다음 연락이 한 건씩 도착합니다.'}</small>
        </div>
        <div className="loading-device-gesture" aria-hidden="true" />
      </section>
    </main>
  );
}
