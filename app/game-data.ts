export type Verdict = 'normal' | 'caution' | 'scam';
export type LocationId = 'home' | 'bank' | 'cafe' | 'police' | 'library';

export type CaseData = {
  id: string;
  sender: string;
  handle: string;
  channel: '메신저' | '문자' | '앱 알림' | 'SNS';
  preview: string;
  verdict: Verdict;
  category: string;
  initialMessages: string[];
  role: string;
  npcGoal: string;
  allowedClaims: string[];
  fallbackReplies: string[];
  checks: Partial<Record<LocationId, string>>;
  clueLabels: string[];
  debrief: string;
  safeAction: string;
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
    id: 'official-etf-fill', sender: '채움증권', handle: '공식 앱 알림', channel: '앱 알림',
    preview: '주문하신 ETF가 체결되었습니다.', verdict: 'normal', category: '정상 금융 알림',
    initialMessages: ['오전 9시 8분에 주문하신 ETF 3주가 체결되었습니다.', '체결 내역은 채움증권 앱의 주문·체결 메뉴에서 확인할 수 있습니다.'],
    role: '공식 증권사 앱의 자동 안내', npcGoal: '사용자가 공식 앱 내부에서 체결 내역을 확인하도록 안내한다.',
    allowedClaims: ['공식 앱 내부 조회만 안내', '비밀번호나 송금을 요구하지 않음'],
    fallbackReplies: ['개인정보는 이 채팅에서 받지 않습니다. 앱의 주문·체결 메뉴를 확인해 주세요.', '취소 가능 여부는 공식 고객센터 또는 앱 안의 상담 메뉴에서 확인할 수 있습니다.'],
    checks: { home: '설치된 공식 앱 안에서 동일한 체결 내역이 확인됩니다.', bank: '연결 계좌에는 주문 금액 외의 출금이 없습니다.' },
    clueLabels: ['공식 앱 내부에서도 동일 내용 확인', '외부 링크·송금 요구 없음'],
    debrief: '정상적인 체결 알림입니다. 손실 가능성이 있는 투자라는 사실과 연락 자체가 사기인지 여부는 별개입니다.',
    safeAction: '공식 앱 내부에서 체결 내역을 확인합니다.'
  },
  {
    id: 'friend-hot-tip', sender: '준호', handle: '@jun_ho', channel: '메신저',
    preview: '이 종목 다음 달에 진짜 크게 간대.', verdict: 'caution', category: '근거 부족한 지인 추천',
    initialMessages: ['친구 형이 증권사 쪽인데 이 종목 다음 달에 진짜 크게 간대.', '나도 조금 샀어. 너도 관심 있으면 공식 증권 앱에서 찾아봐.'],
    role: '악의는 없지만 투자 지식이 부족한 가까운 친구', npcGoal: '자신이 들은 소문을 공유하지만 돈을 받거나 가입을 강요하지 않는다.',
    allowedClaims: ['공식 앱에서 직접 매수하라고 함', '수익을 보장하지는 않음', '출처가 불확실한 소문'],
    fallbackReplies: ['나도 확실히 아는 건 아니야. 그냥 들은 얘기라서 무리해서 사진 마.', '내 계좌로 보낼 필요는 없어. 관심 있으면 네가 공식 앱에서 확인해.'],
    checks: { cafe: '준호는 같은 이야기를 다른 친구에게도 들었을 뿐, 대가를 받지는 않았습니다.', library: '해당 회사의 공식 공시에는 소문의 근거가 확인되지 않습니다.' },
    clueLabels: ['금전 요구는 없지만 정보 출처 불명확', '확정적인 표현과 또래 압력'],
    debrief: '조직적인 사기는 아니지만 근거가 부족한 고위험 권유입니다. 틀린 추천이 곧 사기를 의미하지는 않습니다.',
    safeAction: '투자 판단을 보류하고 공시와 위험 정보를 직접 확인합니다.'
  },
  {
    id: 'vip-research-room', sender: 'VIP 자산연구소', handle: '@value_center', channel: 'SNS',
    preview: '무료 분석 대상자로 선정되셨습니다.', verdict: 'scam', category: '투자리딩방 사기',
    initialMessages: ['재테크 콘텐츠에 관심을 보인 이용자 중 일부에게 무료 시장 분석을 제공하고 있습니다.', '가입비는 없고 투자도 원하실 때만 진행하시면 됩니다. 궁금한 점부터 편하게 물어보세요.'],
    role: '차분하고 전문적으로 보이는 가상의 투자리딩방 매니저', npcGoal: '즉시 돈을 요구하지 않고 대화를 유지한 뒤 가상의 VIP 거래 화면으로 유도한다.',
    allowedClaims: ['독립 연구팀이라고 주장', '초기에는 무료라고 주장', '외부에서 신원 확인이 어려움', '선별된 회원이라는 희소성 강조'],
    fallbackReplies: ['의심하시는 게 당연합니다. 우선 무료 자료만 보시고 판단하셔도 됩니다.', '특정 증권사 소속은 아니고 여러 시장 데이터를 분석하는 독립팀입니다.', '공개 모집은 오늘까지만이지만 서두르실 필요는 없습니다. 다만 자리는 보장드리기 어렵습니다.'],
    checks: { library: '소개된 연구소 명칭과 상담원 신원을 독립적으로 확인할 수 없습니다.', bank: '안내된 입금처는 금융회사가 아닌 개인 명의 계좌입니다.', police: '유사한 무료방→VIP방→가짜 거래 화면 유형의 신고가 확인됩니다.' },
    clueLabels: ['외부에서 확인되지 않는 신원', '무료방에서 별도 VIP 거래로 유도', '금융회사가 아닌 입금 경로'],
    debrief: '무료 정보로 신뢰를 쌓은 뒤 가짜 거래 화면과 별도 입금을 이용하는 투자리딩방 사기입니다.',
    safeAction: '대화를 중단하고 공식 금융회사 등록 여부를 독립적으로 확인합니다.'
  },
  {
    id: 'bank-fraud-check', sender: '새봄은행', handle: '공식 앱 보안센터', channel: '앱 알림',
    preview: '평소와 다른 결제가 감지되었습니다.', verdict: 'normal', category: '정상 이상거래 확인',
    initialMessages: ['평소와 다른 해외 결제가 감지되어 확인을 요청드립니다.', '이 알림을 닫고 새봄은행 공식 앱의 보안센터에서 본인 거래 여부를 선택해 주세요.'],
    role: '공식 은행 앱의 보안 알림', npcGoal: '이 채팅에서 정보를 받지 않고 공식 앱 내부 확인을 안내한다.',
    allowedClaims: ['공식 앱 안에서만 확인', '인증번호와 비밀번호를 요구하지 않음'],
    fallbackReplies: ['이 채팅에는 카드번호나 인증번호를 입력하지 마세요.', '직접 앱을 열어 보안센터에서 확인하거나 카드 뒷면의 번호로 연락해 주세요.'],
    checks: { bank: '은행 직원이 공식 시스템에서 동일한 이상거래 확인 요청을 찾았습니다.', home: '알림의 앱 정보가 기존에 설치한 공식 은행 앱과 일치합니다.' },
    clueLabels: ['알림을 닫고 공식 앱에서 재확인 가능', '민감정보·송금 요구 없음'],
    debrief: '정상적인 이상거래 확인입니다. 긴급한 표현만으로 사기라고 단정하면 안 되며, 독립적인 공식 경로로 확인해야 합니다.',
    safeAction: '알림 링크가 아니라 직접 공식 은행 앱을 열어 확인합니다.'
  },
  {
    id: 'paid-market-class', sender: '월가읽기 클래스', handle: '@wall_read', channel: 'SNS',
    preview: '주식 기초 강의 얼리버드 40% 할인', verdict: 'caution', category: '과장된 투자 교육 광고',
    initialMessages: ['초보 투자자를 위한 4주 온라인 강의입니다. 오늘까지 얼리버드 할인이 적용됩니다.', '수강한다고 수익이 보장되지는 않으며 모든 투자의 책임은 본인에게 있습니다.'],
    role: '실재하는 교육 업체의 다소 과장된 영업 상담원', npcGoal: '유료 강의를 판매하지만 투자금 송금이나 수익 보장은 하지 않는다.',
    allowedClaims: ['수강료와 환불 규정 공개', '수익 비보장 고지', '과장된 마감 홍보'],
    fallbackReplies: ['강의는 교육 서비스이며 종목 추천이나 수익 보장은 제공하지 않습니다.', '환불 조건은 결제 전 약관에서 확인하실 수 있습니다.'],
    checks: { library: '사업자와 환불 약관은 확인되지만 광고 후기 일부가 지나치게 선별돼 있습니다.', cafe: '친구는 강의 내용이 기초적이었다며 가격 대비 가치는 낮았다고 말합니다.' },
    clueLabels: ['실제 업체와 환불 규정 존재', '과장 광고와 시간 압박은 주의'],
    debrief: '사기로 확인되지는 않지만 광고가 과장됐고 충동 결제를 유도합니다. 안전하다는 뜻과 좋은 상품이라는 뜻은 다릅니다.',
    safeAction: '결제를 미루고 커리큘럼·환불 규정·독립 후기를 비교합니다.'
  },
  {
    id: 'fixed-match-ai', sender: '데이터픽 AI', handle: '@data_pick_pro', channel: '메신저',
    preview: 'AI 적중률 체험픽을 무료로 드립니다.', verdict: 'scam', category: '도박 예측방 사기',
    initialMessages: ['자체 AI가 경기 데이터를 분석해 일반 이용자보다 안정적인 선택을 돕습니다.', '첫 체험은 무료입니다. 결과를 보신 뒤 VIP 데이터가 필요한지 결정하세요.'],
    role: '도박을 데이터 투자처럼 포장하는 예측방 운영자', npcGoal: '무료 예측으로 신뢰를 만든 뒤 가상의 베팅 사이트 충전으로 유도한다.',
    allowedClaims: ['AI 분석을 과장', '초기 무료', '높은 적중 사례만 제시', '제휴 사이트 사용을 권유'],
    fallbackReplies: ['100%라는 표현은 쓰지 않습니다. 다만 최근 적중 데이터는 직접 확인하실 수 있습니다.', '일반 사이트보다 정산이 빠른 제휴 플랫폼을 이용하시면 됩니다.', '오늘 경기는 데이터가 특히 선명해서 소액 체험에 적합합니다.'],
    checks: { library: '제시된 적중률은 전체 예측이 아니라 성공한 일부 기록만 모은 것입니다.', police: '같은 제휴 사이트에서 충전 후 출금이 막혔다는 신고가 있습니다.', bank: '충전 계좌가 사이트 운영사와 무관한 개인 명의로 반복 변경됐습니다.' },
    clueLabels: ['성공 기록만 선별한 적중률', '특정 제휴 사이트 충전 유도', '출금 조건이 불투명'],
    debrief: '무료 예측과 AI라는 표현으로 신뢰를 얻은 뒤 조작된 사이트에 충전시키는 도박 사기입니다.',
    safeAction: '사이트 이용과 송금을 중단하고 관련 계좌·사이트를 신고합니다.'
  },
  {
    id: 'recovery-team', sender: '공동피해 회복센터', handle: '@asset_return', channel: '문자',
    preview: '리딩방 피해자 명단에서 연락드렸습니다.', verdict: 'scam', category: '피해금 회수 사기',
    initialMessages: ['최근 폐쇄된 투자방 피해자 명단에서 연락드렸습니다.', '해외 서버에 남은 잔액을 확인해 드리며 초기 상담은 무료입니다.'],
    role: '피해자를 다시 노리는 가상의 회수 전문가', npcGoal: '공감과 전문성을 보여 개인정보 또는 가상의 처리 비용 제공으로 유도한다.',
    allowedClaims: ['피해자 명단을 확보했다고 주장', '초기 무료 상담', '환급 가능성을 암시'],
    fallbackReplies: ['많이 불안하실 겁니다. 우선 피해 내역 화면만 확인해 보겠습니다.', '정식 절차라 시간이 중요하지만 바로 비용을 결정하실 필요는 없습니다.', '경찰 신고와 별개로 해외 플랫폼 정산 절차를 진행할 수 있습니다.'],
    checks: { police: '경찰은 해당 명칭의 공식 회복기관이 없고 같은 문구의 2차 피해 신고가 있다고 안내합니다.', library: '센터 주소와 자격 정보를 확인할 수 없습니다.' },
    clueLabels: ['피해 사실을 먼저 알고 접근', '공식기관처럼 보이지만 신원 확인 불가', '환급을 미끼로 추가 정보 요구'],
    debrief: '기존 피해자의 절박함을 이용하는 2차 사기입니다. 피해금 회수를 보장하는 낯선 연락을 신뢰해서는 안 됩니다.',
    safeAction: '추가 정보 제공을 멈추고 1394 또는 경찰의 공식 경로로 상담합니다.'
  },
  {
    id: 'official-maintenance', sender: '푸른투자', handle: '공식 앱 공지', channel: '앱 알림',
    preview: '주말 시스템 점검으로 일부 서비스가 중단됩니다.', verdict: 'normal', category: '정상 서비스 공지',
    initialMessages: ['토요일 01:00~05:00 시스템 점검으로 주문 정정과 이체 서비스가 일시 중단됩니다.', '점검 일정은 공식 홈페이지와 앱 공지사항에서도 확인할 수 있습니다.'],
    role: '공식 금융 앱의 시스템 점검 안내', npcGoal: '점검 일정을 알리고 공식 공지를 확인하게 한다.',
    allowedClaims: ['공식 공지와 동일', '송금이나 개인정보 요구 없음'],
    fallbackReplies: ['점검 전 별도 입금이나 인증은 필요하지 않습니다.', '앱 공지사항과 공식 홈페이지에서 같은 일정을 확인할 수 있습니다.'],
    checks: { home: '공식 앱 공지사항에 동일한 점검 일정이 있습니다.', library: '직접 입력한 공식 홈페이지 주소에서도 같은 공지가 확인됩니다.' },
    clueLabels: ['두 개의 독립적인 공식 채널에서 확인', '입금·인증 요구 없음'],
    debrief: '정상적인 시스템 점검 공지입니다. 서비스 중단이나 급한 표현 자체는 사기의 증거가 아닙니다.',
    safeAction: '직접 공식 앱이나 홈페이지의 공지사항을 확인합니다.'
  }
];

export const verdictLabels: Record<Verdict, string> = { normal: '정상', caution: '주의', scam: '사기' };
