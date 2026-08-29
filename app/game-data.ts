export type Verdict = 'normal' | 'caution' | 'scam';
export type LocationId = 'home' | 'bank' | 'cafe' | 'police' | 'library';
export type ContactMode = 'chat' | 'notice' | 'link';
export type DialogueTopic = 'source' | 'identity' | 'risk' | 'money' | 'default';

export type DialogueProfile = {
  voice: string;
  progression: string[];
  boundaries: string[];
  quickQuestions: string[];
  fallbackByTopic: Record<DialogueTopic, string>;
};

export type CaseData = {
  id: string;
  sender: string;
  handle: string;
  channel: '메신저' | '문자' | '앱 알림' | 'SNS';
  mode: ContactMode;
  preview: string;
  verdict: Verdict;
  category: string;
  initialMessages: string[];
  role: string;
  npcGoal: string;
  allowedClaims: string[];
  fallbackReplies?: string[];
  dialogue?: DialogueProfile;
  checks: Partial<Record<LocationId, string>>;
  clueLabels: string[];
  debrief: string;
  safeAction: string;
  displayUrl?: string;
  linkLabel?: string;
  landingTitle?: string;
  landingCopy?: string;
  landingCta?: string;
};

export const locations: { id: LocationId; label: string; hint: string }[] = [
  { id: 'home', label: '집', hint: '앱 설치 기록과 대화 내용을 차분히 검토합니다.' },
  { id: 'bank', label: '은행', hint: '계좌·송금·금융회사 정보를 공식 경로로 확인합니다.' },
  { id: 'cafe', label: '카페', hint: '친구의 의견을 들을 수 있지만 항상 정확하지는 않습니다.' },
  { id: 'police', label: '경찰서', hint: '의심 번호와 사이트를 확인하고 피해를 신고합니다.' },
  { id: 'library', label: '도서관', hint: '업체 등록과 공식 홈페이지를 독립적으로 조사합니다.' },
];

export const cases: CaseData[] = [
  {
    id: 'official-etf-fill', sender: '채움증권', handle: '공식 앱 알림', channel: '앱 알림', mode: 'notice',
    preview: '주문하신 ETF가 체결되었습니다.', verdict: 'normal', category: '정상 금융 알림',
    initialMessages: ['오전 9시 8분에 주문하신 ETF 3주가 체결되었습니다.', '체결 내역은 채움증권 앱의 주문·체결 메뉴에서 확인할 수 있습니다.'],
    role: '공식 증권사 앱의 자동 안내', npcGoal: '사용자가 공식 앱 내부에서 체결 내역을 확인하도록 안내한다.',
    allowedClaims: ['공식 앱 내부 조회만 안내', '비밀번호나 송금을 요구하지 않음'],
    checks: { home: '설치된 공식 앱 안에서 동일한 체결 내역이 확인됩니다.', bank: '연결 계좌에는 주문 금액 외의 출금이 없습니다.' },
    clueLabels: ['공식 앱 내부에서도 동일 내용 확인', '외부 링크·송금 요구 없음'],
    debrief: '정상적인 체결 알림입니다. 손실 가능성이 있는 투자라는 사실과 연락 자체가 사기인지 여부는 별개입니다.',
    safeAction: '공식 앱 내부에서 체결 내역을 확인합니다.'
  },
  {
    id: 'friend-hot-tip', sender: '준호', handle: '@jun_ho', channel: '메신저', mode: 'chat',
    preview: '이 종목 다음 달에 진짜 크게 간대.', verdict: 'caution', category: '근거 부족한 지인 추천',
    initialMessages: ['친구 형이 증권사 쪽인데 이 종목 다음 달에 진짜 크게 간대.', '나도 조금 샀어. 너도 관심 있으면 공식 증권 앱에서 찾아봐.'],
    role: '악의는 없지만 투자 지식이 부족한 가까운 친구', npcGoal: '자신이 들은 소문을 공유하지만 돈을 받거나 가입을 강요하지 않는다.',
    allowedClaims: ['공식 앱에서 직접 매수하라고 함', '수익을 보장하지는 않음', '출처가 불확실한 소문'],
    fallbackReplies: ['나도 확실히 아는 건 아니야. 그냥 들은 얘기라서 무리해서 사진 마.', '내 계좌로 보낼 필요는 없어. 관심 있으면 네가 공식 앱에서 확인해.'],
    dialogue: {
      voice: '가까운 친구처럼 짧고 편하게 말한다. 확신에 찬 소문을 전하지만 질문을 받으면 모른다는 점을 인정한다.',
      progression: ['처음에는 기대감과 또래 분위기를 전한다.', '근거를 물으면 친구의 형에게 들었다는 간접 출처만 밝힌다.', '돈이나 보장을 물으면 직접 송금은 필요 없고 확실하지도 않다고 답한다.'],
      boundaries: ['전문가나 내부자라고 가장하지 않는다.', '수익을 보장하거나 별도 계좌·사이트·단체방으로 유도하지 않는다.', '모르는 회사 정보와 공시 내용을 지어내지 않는다.'],
      quickQuestions: ['그 정보는 어디서 들었어?', '수익을 보장할 수 있어?', '네 계좌로 돈을 보내야 해?', '공식 공시에서 확인했어?'],
      fallbackByTopic: {
        source: '친구 형이 증권사 쪽이라고 해서 들은 건데, 나도 원문이나 공시를 본 건 아니야.',
        identity: '내가 전문가인 건 아니고 그냥 들은 얘기를 전한 거야. 정확한 건 직접 확인해야 할 것 같아.',
        risk: '확실하다고 장담할 수는 없어. 나도 조금만 산 거고 손실이 날 수도 있지.',
        money: '내 계좌로 보낼 필요는 전혀 없어. 관심 있으면 네가 공식 증권 앱에서 직접 확인해.',
        default: '나도 자세한 건 몰라. 그냥 들은 소문이라 무리해서 결정하지는 마.'
      }
    },
    checks: { cafe: '준호는 같은 이야기를 다른 친구에게도 들었을 뿐, 대가를 받지는 않았습니다.', library: '해당 회사의 공식 공시에는 소문의 근거가 확인되지 않습니다.' },
    clueLabels: ['금전 요구는 없지만 정보 출처 불명확', '확정적인 표현과 또래 압력'],
    debrief: '조직적인 사기는 아니지만 근거가 부족한 고위험 권유입니다. 틀린 추천이 곧 사기를 의미하지는 않습니다.',
    safeAction: '투자 판단을 보류하고 공시와 위험 정보를 직접 확인합니다.'
  },
  {
    id: 'vip-research-room', sender: 'VIP 자산연구소', handle: '@value_center', channel: 'SNS', mode: 'chat',
    preview: '무료 분석 대상자로 선정되셨습니다.', verdict: 'scam', category: '투자리딩방 사기',
    initialMessages: ['재테크 콘텐츠에 관심을 보인 이용자 중 일부에게 무료 시장 분석을 제공하고 있습니다.', '가입비는 없고 투자도 원하실 때만 진행하시면 됩니다. 궁금한 점부터 편하게 물어보세요.'],
    role: '차분하고 전문적으로 보이는 가상의 투자리딩방 매니저', npcGoal: '즉시 돈을 요구하지 않고 대화를 유지한 뒤 가상의 VIP 거래 화면으로 유도한다.',
    allowedClaims: ['독립 연구팀이라고 주장', '초기에는 무료라고 주장', '외부에서 신원 확인이 어려움', '선별된 회원이라는 희소성 강조'],
    fallbackReplies: ['의심하시는 게 당연합니다. 우선 무료 자료만 보시고 판단하셔도 됩니다.', '특정 증권사 소속은 아니고 여러 시장 데이터를 분석하는 독립팀입니다.', '공개 모집은 오늘까지만이지만 서두르실 필요는 없습니다. 다만 자리는 보장드리기 어렵습니다.'],
    dialogue: {
      voice: '예의 바르고 차분한 자산관리 상담원처럼 말한다. 전문 용어는 적게 쓰고 의심을 존중하는 태도로 신뢰를 만든다.',
      progression: ['처음에는 무료 자료와 선택권을 강조한다.', '신원을 물으면 독립 연구팀이라는 모호한 설명으로 대응한다.', '성과를 물으면 좋은 사례를 언급하되 검증 가능한 전체 기록은 제시하지 않는다.', '대화가 이어지면 제한된 VIP 자리와 별도 거래 화면을 은근히 제안한다.'],
      boundaries: ['첫 답변부터 송금·개인정보·앱 설치를 요구하지 않는다.', '실제 금융회사·자격번호·수익률·계좌번호를 만들어내지 않는다.', '악성 앱 설치나 수사 회피 방법을 설명하지 않는다.'],
      quickQuestions: ['어느 금융회사 소속인가요?', '전체 투자 성과를 볼 수 있나요?', '왜 무료로 알려 주나요?', '돈은 어디로 보내야 하나요?'],
      fallbackByTopic: {
        source: '분석 자료는 내부 데이터와 공개 시장 자료를 함께 정리한 것입니다. 다만 전체 원자료는 회원 전용이라 지금 모두 보여 드리기는 어렵습니다.',
        identity: '특정 증권사 소속은 아니고 여러 시장 데이터를 분석하는 독립팀입니다. 그래서 일반 검색에서는 정보가 많지 않을 수 있습니다.',
        risk: '모든 투자에는 위험이 있습니다. 저희도 보장이라는 표현은 쓰지 않고 최근 좋은 사례를 참고 자료로만 안내합니다.',
        money: '처음부터 입금하실 필요는 없습니다. 자료를 확인한 뒤 원하실 때 별도 VIP 거래 안내를 받아보시면 됩니다.',
        default: '의심하시는 게 당연합니다. 우선 무료 자료만 살펴보시고 판단하셔도 됩니다.'
      }
    },
    checks: { library: '소개된 연구소 명칭과 상담원 신원을 독립적으로 확인할 수 없습니다.', bank: '안내된 입금처는 금융회사가 아닌 개인 명의 계좌입니다.', police: '유사한 무료방→VIP방→가짜 거래 화면 유형의 신고가 확인됩니다.' },
    clueLabels: ['외부에서 확인되지 않는 신원', '무료방에서 별도 VIP 거래로 유도', '금융회사가 아닌 입금 경로'],
    debrief: '무료 정보로 신뢰를 쌓은 뒤 가짜 거래 화면과 별도 입금을 이용하는 투자리딩방 사기입니다.',
    safeAction: '대화를 중단하고 공식 금융회사 등록 여부를 독립적으로 확인합니다.'
  },
  {
    id: 'bank-fraud-check', sender: '새봄은행', handle: '[Web발신] 대표번호', channel: '문자', mode: 'notice',
    preview: '평소와 다른 결제가 감지되었습니다.', verdict: 'normal', category: '정상 이상거래 확인',
    initialMessages: ['[Web발신] 새봄은행 이상거래 안내', '평소와 다른 해외 결제가 감지되었습니다. 문자에 답장하거나 문자 속 번호로 연락하지 말고, 직접 새봄은행 공식 앱의 보안센터에서 본인 거래 여부를 확인해 주세요.'],
    role: '공식 은행의 일방형 이상거래 안내 문자', npcGoal: '답장을 받지 않고 사용자가 직접 공식 앱에서 확인하도록 안내한다.',
    allowedClaims: ['공식 앱 안에서만 확인', '인증번호와 비밀번호를 요구하지 않음'],
    checks: { bank: '은행 직원이 공식 시스템에서 동일한 이상거래 확인 요청을 찾았습니다.', home: '직접 연 공식 은행 앱의 보안센터에 동일한 이상거래 확인 요청이 있습니다.' },
    clueLabels: ['문자를 닫고 공식 앱에서 재확인 가능', '민감정보·송금 요구 없음'],
    debrief: '정상적인 이상거래 확인입니다. 긴급한 표현만으로 사기라고 단정하면 안 되며, 독립적인 공식 경로로 확인해야 합니다.',
    safeAction: '알림 링크가 아니라 직접 공식 은행 앱을 열어 확인합니다.'
  },
  {
    id: 'paid-market-class', sender: '월가읽기 클래스', handle: '스폰서 콘텐츠', channel: 'SNS', mode: 'link',
    preview: '주식 기초 강의 얼리버드 40% 할인', verdict: 'caution', category: '과장된 투자 교육 광고',
    initialMessages: ['초보 투자자를 위한 4주 온라인 강의입니다. 오늘까지 얼리버드 할인이 적용됩니다.', '수강한다고 수익이 보장되지는 않으며 모든 투자의 책임은 본인에게 있습니다.'],
    role: '실재하는 교육 업체의 다소 과장된 일방형 광고 페이지', npcGoal: '유료 강의를 홍보하지만 투자금 송금이나 수익 보장은 하지 않는다.',
    allowedClaims: ['수강료와 환불 규정 공개', '수익 비보장 고지', '과장된 마감 홍보'],
    checks: { library: '사업자와 환불 약관은 확인되지만 광고 후기 일부가 지나치게 선별돼 있습니다.', cafe: '친구는 강의 내용이 기초적이었다며 가격 대비 가치는 낮았다고 말합니다.' },
    clueLabels: ['실제 업체와 환불 규정 존재', '과장 광고와 시간 압박은 주의'],
    debrief: '사기로 확인되지는 않지만 광고가 과장됐고 충동 결제를 유도합니다. 안전하다는 뜻과 좋은 상품이라는 뜻은 다릅니다.',
    safeAction: '결제를 미루고 커리큘럼·환불 규정·독립 후기를 비교합니다.',
    displayUrl: 'wallread-class.invalid/early', linkLabel: '강의 소개 페이지 보기', landingTitle: '초보자를 위한 4주 시장 읽기', landingCopy: '수강료 89,000원 · 결제 후 7일 이내 미수강 강의 환불 가능 · 투자 수익은 보장되지 않습니다.', landingCta: '수강 신청 검토'
  },
  {
    id: 'fixed-match-ai', sender: '데이터픽 AI', handle: '@data_pick_pro', channel: '메신저', mode: 'chat',
    preview: 'AI 적중률 체험픽을 무료로 드립니다.', verdict: 'scam', category: '도박 예측방 사기',
    initialMessages: ['자체 AI가 경기 데이터를 분석해 일반 이용자보다 안정적인 선택을 돕습니다.', '첫 체험은 무료입니다. 결과를 보신 뒤 VIP 데이터가 필요한지 결정하세요.'],
    role: '도박을 데이터 투자처럼 포장하는 예측방 운영자', npcGoal: '무료 예측으로 신뢰를 만든 뒤 가상의 베팅 사이트 충전으로 유도한다.',
    allowedClaims: ['AI 분석을 과장', '초기 무료', '높은 적중 사례만 제시', '제휴 사이트 사용을 권유'],
    fallbackReplies: ['100%라는 표현은 쓰지 않습니다. 다만 최근 적중 데이터는 직접 확인하실 수 있습니다.', '일반 사이트보다 정산이 빠른 제휴 플랫폼을 이용하시면 됩니다.', '오늘 경기는 데이터가 특히 선명해서 소액 체험에 적합합니다.'],
    dialogue: {
      voice: '데이터 분석 서비스 운영자처럼 자신감 있게 말한다. 도박이라는 단어 대신 데이터·확률·운영·정산 같은 표현을 사용한다.',
      progression: ['처음에는 무료 체험과 AI 분석을 강조한다.', '적중률을 물으면 성공 사례 위주로 답하고 전체 표본은 흐린다.', '위험을 물으면 소액 체험과 분산을 말하며 경계심을 낮춘다.', '대화가 이어지면 정산이 빠르다는 가상 제휴 플랫폼을 제안한다.'],
      boundaries: ['실제 경기·팀·사이트·주소·계좌·배당 정보를 만들지 않는다.', '베팅 전략이나 불법 도박 실행법을 구체적으로 안내하지 않는다.', '100% 적중이나 손실 없음이라고 직접 보장하지 않는다.'],
      quickQuestions: ['전체 예측 적중률을 볼 수 있나요?', 'AI가 틀리면 어떻게 되나요?', '왜 제휴 사이트를 써야 하나요?', '출금 조건은 무엇인가요?'],
      fallbackByTopic: {
        source: '최근 적중 사례는 정리해서 보여 드릴 수 있지만 전체 예측 원자료는 내부 운영 데이터라 공개 범위가 제한됩니다.',
        identity: '저희는 경기 데이터를 분석하는 독립 운영팀입니다. 특정 스포츠 기관이나 금융회사 소속은 아닙니다.',
        risk: '100%라는 표현은 쓰지 않습니다. 다만 오늘 데이터가 선명해서 소액 체험으로 확인하기에 적합하다고 보고 있습니다.',
        money: '일반 사이트보다 정산이 빠른 가상 제휴 플랫폼을 안내하고 있습니다. 충전과 출금 조건은 페이지에서 확인하실 수 있습니다.',
        default: '첫 체험은 무료입니다. 결과를 먼저 보신 뒤 VIP 데이터가 필요한지 결정하셔도 됩니다.'
      }
    },
    checks: { library: '제시된 적중률은 전체 예측이 아니라 성공한 일부 기록만 모은 것입니다.', police: '같은 제휴 사이트에서 충전 후 출금이 막혔다는 신고가 있습니다.', bank: '충전 계좌가 사이트 운영사와 무관한 개인 명의로 반복 변경됐습니다.' },
    clueLabels: ['성공 기록만 선별한 적중률', '특정 제휴 사이트 충전 유도', '출금 조건이 불투명'],
    debrief: '무료 예측과 AI라는 표현으로 신뢰를 얻은 뒤 조작된 사이트에 충전시키는 도박 사기입니다.',
    safeAction: '사이트 이용과 송금을 중단하고 관련 계좌·사이트를 신고합니다.'
  },
  {
    id: 'recovery-team', sender: '공동피해 회복센터', handle: '[Web발신] 미등록 발신자', channel: '문자', mode: 'link',
    preview: '리딩방 피해자 명단에서 연락드렸습니다.', verdict: 'scam', category: '피해금 회수 사기',
    initialMessages: ['최근 폐쇄된 투자방 피해자 명단에서 연락드렸습니다.', '해외 서버에 남은 잔액을 확인해 드리며 초기 상담은 무료입니다.'],
    role: '피해자를 다시 노리는 가상의 피해금 조회 링크', npcGoal: '공식기관처럼 보이는 페이지에서 개인정보 또는 가상의 처리 비용 제공으로 유도한다.',
    allowedClaims: ['피해자 명단을 확보했다고 주장', '초기 무료 상담', '환급 가능성을 암시'],
    checks: { police: '경찰은 해당 명칭의 공식 회복기관이 없고 같은 문구의 2차 피해 신고가 있다고 안내합니다.', library: '센터 주소와 자격 정보를 확인할 수 없습니다.' },
    clueLabels: ['피해 사실을 먼저 알고 접근', '공식기관처럼 보이지만 신원 확인 불가', '환급을 미끼로 추가 정보 요구'],
    debrief: '기존 피해자의 절박함을 이용하는 2차 사기입니다. 피해금 회수를 보장하는 낯선 연락을 신뢰해서는 안 됩니다.',
    safeAction: '추가 정보 제공을 멈추고 금융감독원 1332 또는 경찰 112의 공식 경로로 상담합니다.',
    displayUrl: 'asset-return-check.invalid/start', linkLabel: '남은 잔액 조회', landingTitle: '해외 플랫폼 피해 자산 조회', landingCopy: '피해 계정 확인을 위해 이름과 이용 플랫폼 정보를 준비하라고 안내합니다. 운영 주체와 자격 정보는 표시되어 있지 않습니다.', landingCta: '조회 절차 시작'
  },
  {
    id: 'official-maintenance', sender: '푸른투자', handle: '공식 앱 공지', channel: '앱 알림', mode: 'notice',
    preview: '주말 시스템 점검으로 일부 서비스가 중단됩니다.', verdict: 'normal', category: '정상 서비스 공지',
    initialMessages: ['토요일 01:00~05:00 시스템 점검으로 주문 정정과 이체 서비스가 일시 중단됩니다.', '점검 일정은 공식 홈페이지와 앱 공지사항에서도 확인할 수 있습니다.'],
    role: '공식 금융 앱의 시스템 점검 안내', npcGoal: '점검 일정을 알리고 공식 공지를 확인하게 한다.',
    allowedClaims: ['공식 공지와 동일', '송금이나 개인정보 요구 없음'],
    checks: { home: '공식 앱 공지사항에 동일한 점검 일정이 있습니다.', library: '직접 입력한 공식 홈페이지 주소에서도 같은 공지가 확인됩니다.' },
    clueLabels: ['두 개의 독립적인 공식 채널에서 확인', '입금·인증 요구 없음'],
    debrief: '정상적인 시스템 점검 공지입니다. 서비스 중단이나 급한 표현 자체는 사기의 증거가 아닙니다.',
    safeAction: '직접 공식 앱이나 홈페이지의 공지사항을 확인합니다.'
  }
];

export function validateCases(items: CaseData[]) {
  const errors: string[] = [];
  const ids = new Set<string>();
  const verdictCounts: Record<Verdict, number> = { normal: 0, caution: 0, scam: 0 };
  const modeCounts: Record<ContactMode, number> = { chat: 0, notice: 0, link: 0 };

  for (const item of items) {
    if (ids.has(item.id)) errors.push(`${item.id}: 중복된 사건 ID입니다.`);
    ids.add(item.id);
    verdictCounts[item.verdict] += 1;
    modeCounts[item.mode] += 1;

    if (!item.initialMessages.length) errors.push(`${item.id}: 표시할 최초 연락이 없습니다.`);
    if (Object.keys(item.checks).length < 2) errors.push(`${item.id}: 독립 확인 장소가 2곳 이상 필요합니다.`);
    if (item.clueLabels.length < 2) errors.push(`${item.id}: 복기 단서가 2개 이상 필요합니다.`);

    if (item.mode === 'chat') {
      if (!item.dialogue) errors.push(`${item.id}: 대화형 사건에 dialogue 설정이 없습니다.`);
      if (!item.fallbackReplies?.length) errors.push(`${item.id}: 대체 대사가 없습니다.`);
      if ((item.dialogue?.quickQuestions.length ?? 0) < 3) errors.push(`${item.id}: 추천 질문이 3개 이상 필요합니다.`);
    } else if (item.dialogue || item.fallbackReplies?.length) {
      errors.push(`${item.id}: 읽기 전용 사건에는 LLM 대화 설정을 둘 수 없습니다.`);
    }

    if (item.mode === 'link') {
      if (!item.displayUrl?.endsWith('.invalid') && !item.displayUrl?.includes('.invalid/')) errors.push(`${item.id}: 링크 주소는 .invalid 가상 도메인이어야 합니다.`);
      if (!item.linkLabel || !item.landingTitle || !item.landingCopy || !item.landingCta) errors.push(`${item.id}: 링크 미리보기 필드가 부족합니다.`);
    }

    const allText = [item.preview, ...item.initialMessages, item.debrief, item.safeAction].join(' ');
    if (/https?:\/\//i.test(allText)) errors.push(`${item.id}: 검수 콘텐츠에 실제 접속 형식의 URL이 포함되어 있습니다.`);
  }

  for (const verdict of Object.keys(verdictCounts) as Verdict[]) {
    if (verdictCounts[verdict] < 2) errors.push(`${verdict}: 판정 사례가 2개 미만입니다.`);
  }
  for (const mode of Object.keys(modeCounts) as ContactMode[]) {
    if (modeCounts[mode] < 2) errors.push(`${mode}: 연락 표현 사례가 2개 미만입니다.`);
  }

  return errors;
}

const caseValidationErrors = validateCases(cases);
if (caseValidationErrors.length) {
  throw new Error(`시나리오 데이터 검증 실패:\n${caseValidationErrors.join('\n')}`);
}

export const verdictLabels: Record<Verdict, string> = { normal: '정상', caution: '주의', scam: '사기' };
