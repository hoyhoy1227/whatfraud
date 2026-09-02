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
      <div className="loading-phone-silhouette" aria-hidden="true"><i /><i /><i /></div>
      <div className="game-loading-shade" />
      <section className="game-loading-card" role="status" aria-label={`${title} ${safeProgress}%`}>
        <div className="loading-mark" aria-hidden="true"><span>24</span><i /><i /><i /></div>
        <span className="pixel-label">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{detail}</p>
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
        <div className="loading-progress-copy"><b>{String(safeProgress).padStart(2, '0')}%</b><span>{safeProgress === 100 ? '준비 완료' : '잠시만 기다려 주세요'}</span></div>
        <ol className="loading-steps" aria-label="준비 단계">
          {steps.map((step, index) => (
            <li key={step} className={index < activeStep || safeProgress === 100 ? 'done' : index === activeStep ? 'active' : ''}>
              <i>{index < activeStep || safeProgress === 100 ? '✓' : index + 1}</i><span>{step}</span>
            </li>
          ))}
        </ol>
        <small>{variant === 'startup' ? 'Gemini 연결 확인은 게임 화면을 먼저 연 뒤 백그라운드에서 이어집니다.' : '연락은 판정을 마칠 때마다 한 건씩 도착합니다.'}</small>
      </section>
    </main>
  );
}
