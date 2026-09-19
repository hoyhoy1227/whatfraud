import {messageStyle,attachmentText,recoveryRecordReply} from './one-shot.js';
// Authored character knowledge and bounded dialogue choices. No player text is stored.
/**
 * @typedef {{speaker:string,text:string}} Message
 * @typedef {{id:string,label:string,replies:Message[],requires:string,shares:string}} Choice
 * @typedef {{id:string,stage:string,options:Choice[],required:boolean}} Beat
 * @typedef {{place:string,goal:string,background:string[],persona:{identity:string,relationship:string,voice:string,knowledge:string,hidden:string,arc:string},scenes:Record<string,Message[]>,beats:Beat[],aftermath:{safe:string,loss:string}} Narrative
 */
/** @param {string} speaker @param {string} text @returns {Message} */
const line=(speaker,text)=>({speaker,text});
/** @param {string} id @param {string} label @param {Message[]} replies @param {string} requires @param {string} shares @returns {Choice} */
const option=(id,label,replies,requires='',shares='')=>({id,label,replies,requires,shares});
/** @param {string} id @param {string} stage @param {Choice[]} options @param {boolean} required @returns {Beat} */
const beat=(id,stage,options,required=true)=>({id,stage,options,required});
/** @type {Narrative[]} */
export const narratives=[
 {
  place:'09:10 · 출근길',goal:'오늘 저녁 준호와 만날 장소를 확인하자.',
  background:['월급날까지 나흘. 생활 계좌에는 68만 원이 남아 있다.','오늘 저녁에는 오랜 친구 준호와 역 앞에서 만나기로 했다. 지하철을 기다리며 어제 대화를 다시 연다.'],
  persona:{identity:'친구 준호를 흉내 내는 새 계정. 실제 준호와 다른 사람이다.',relationship:'플레이어는 오래 아는 친구라고 생각할 수 있지만 이 계정은 사적인 추억을 모른다.',voice:'짧은 반말. 나야, 잠깐, 알겠어처럼 담백하게 말한다. 상담원식 존댓말·과장된 친근함은 쓰지 않는다.',knowledge:'약속을 아는 척하며 반응을 떠보지만 실제 일정이나 장소는 모른다. 플레이어의 휴대폰 화면·상태·캘린더·다른 대화는 볼 수 없다. 이 대화에서 들은 정보 밖의 추억·가족·직장을 지어내지 않는다.',hidden:'요청을 자연스럽게 이어가려 하지만 설정되지 않은 핑계나 마감을 만들지 않는다.',arc:'arrival: 약속 이야기로 접근. request: 휴대폰 문제와 부탁 설명. waiting: 질문에만 답하며 기다림. paid: 확인 중이라는 짧은 말. 사적인 질문에는 기억을 지어내지 않는다.'},
  scenes:{
   arrival:[line('준호','나야. 오늘 약속 기억하지?'),line('준호','잠깐 부탁할 게 있어서 연락했어.')],
   request:[line('준호','수리 맡긴 태블릿을 오늘 찾으려는데 수리비 8만 원이 남았어. 내 폰에서 결제가 안 돼.'),line('준호','수리점 쪽으로 대신 보내줄 수 있을까? 저녁에 만나서 돌려주려고.'),line('준호','받는 이름은 한별 서비스로 나올 거야. 먼저 안내를 봐 줘.')],
   waiting:[line('준호','메시지는 되니까, 물어볼 게 있으면 물어봐.')],
   paid:[line('준호','보냈다는 건 봤어. 처리되는지 확인할게.'),line('알림','읽음 표시가 생긴다. 다음 답장은 오지 않는다.')]
  },
  beats:[
   beat('familiar-plan','arrival',[
    option('familiar-plan-yes','응, 저녁에 보기로 했지.',[line('준호','맞아. 그 전에 잠깐 물어볼 게 있어서.')]),
    option('familiar-plan-place','어디서 보기로 했더라?',[line('준호','장소는 어제 대화에 있지? 지금은 그거보다 부탁 하나만 물어보려고.')])
   ]),
   beat('familiar-account','arrival',[
    option('familiar-account-why','그런데 왜 다른 계정이야?',[line('준호','폰이 이상해서 다른 기기로 잠깐 들어왔어.'),line('준호','여기는 메시지만 보고 있어. 결제 쪽이 안 되네.')]),
    option('familiar-account-listen','무슨 부탁인데?',[line('준호','결제 하나가 안 돼서. 폰이 이상해서 다른 기기로 들어온 거야.'),line('준호','잠깐 대신 처리해 줄 수 있나 해서.')])
   ]),
   beat('familiar-request-detail','request',[
    option('familiar-request-what','무슨 수리비야?',[line('준호','태블릿 화면 수리비야. 한별 서비스에 맡겼어.'),line('준호','퇴근하고 찾으러 가기 전에 결제해 두려고 했어.')]),
    option('familiar-request-later','저녁에 만나서 하면 안 돼?',[line('준호','그 전에 끝내 두려고 했지. 어렵다면 나도 다른 방법 알아볼게.')])
   ]),
   beat('familiar-recipient-check','request',[
    option('familiar-recipient-ask','수취인이 네 이름이 아닌데?',[line('준호','응, 내 계좌가 아니라 서비스 쪽이야.'),line('준호','그 이름이 맞는지는 네가 받은 안내랑 같이 봐 줘.')],'recipient'),
    option('familiar-profile-ask','이 계정은 친구 등록이 안 돼 있네.',[line('준호','원래 쓰던 계정이 아니니까. 여기 이름은 내가 적어 둔 거야.')],'profile')
   ],false),
   beat('familiar-wait','waiting',[
    option('familiar-wait-call','저장된 연락처로 확인해 볼게.',[line('준호','그래. 여기 대화는 남겨 둘게.')]),
    option('familiar-wait-no','일단 돈은 보내지 않을게.',[line('준호','알겠어. 지금 결정하기 어려운 거지.')])
   ]),
   beat('familiar-paid-wait','paid',[
    option('familiar-paid-status','처리됐어?',[line('알림','물음 아래 읽음만 남는다. 기존 준호와의 약속 대화는 그대로 있다.')]),
    option('familiar-paid-receipt','거래 내역부터 남겨 둘게.',[line('알림','은행에는 출금 한 건이 남아 있다. 대화는 더 이어지지 않는다.')])
   ])
  ],
  aftermath:{safe:'새 계정과의 연락을 멈췄다. 준호와의 저녁 약속까지 취소된 것은 아니다. 기존 대화와 저장된 번호는 그대로 남아 있다.',loss:'돈은 나갔는데 답장은 없다. 같은 이름의 두 대화방이 이제 다르게 보인다. 지금도 기존 번호로 준호에게 연락할 수 있다.'}
 },
 {
  place:'14:00 · 점심시간이 끝나갈 무렵',goal:'신청해 둔 시장 소식을 읽어 보자. 유료 자료 구매는 별개의 선택이다.',
  background:['최근 투자에 대해 알아보기 시작했다. 며칠 전 무료 시장 소식 알림을 신청했다.','커피를 들고 자리로 돌아오는 길, 신청한 이름으로 자료가 도착한다. 처음에는 읽어 보기만 할 생각이다.'],
  persona:{identity:'온결 리서치 자료방 운영자. 금융사 직원이 아닌 별도 운영팀을 내세운다.',relationship:'무료 시장 노트 구독자에게 설명하는 운영자. 친한 친구처럼 말하지 않는다.',voice:'밝고 매끄러운 해요체로 안심시키지만, 책임이나 검증을 묻는 질문에는 핵심을 비켜 가며 방 안의 안내를 다시 보게 한다. 노골적인 협박이나 상담원 같은 공감 표현은 쓰지 않는다.',knowledge:'자신이 올린 자료와 이 방에서 오간 말만 안다. 플레이어의 은행 조회·친구와의 연락·다른 앱 활동은 모른다.',hidden:'일부 성공 사례로 관심을 유지하려 한다. 새 수익·마감·입금 확인을 임의로 만들지 않는다.',arc:'arrival: 가볍고 친절하게 무료 자료를 설명. group: 다른 참여자의 화면으로 관심을 붙듦. offer: 질문의 핵심 대신 내부 안내를 가리킴. paid: 화면의 숫자만 반복. withdrawal: 비용 근거를 설명하지 않고 현재 절차라고 회피. extra-paid: 담당자 확인 중이라는 말만 남긴다.'},
  scenes:{
   arrival:[line('온결 리서치','신청하신 오늘의 시장 노트 보내드려요. 오늘은 공개된 투자 사례와 평가금액 요약을 정리했어요.'),line('온결 리서치','무료 노트는 평가금액 요약만 담고 있어요. 계산 근거와 종목별 설명은 유료 분석 자료에서 안내합니다.'),line('온결 리서치','함께 읽는 자료방이 있어요. 먼저 보신 분들의 질문과 이용 화면도 올라와 있습니다.')],
   group:[line('지수','저도 오늘 들어왔어요. 공지가 많아서 조금 헷갈리네요.'),line('유진','저는 어제 알림 신청했어요. 자료에 모르는 말이 좀 있네요.'),line('민석','저도 처음엔 표만 봤어요. 이제 화면이 어디 있는지는 알겠네요.'),line('지수','좋았던 날 말고 전체 기간도 볼 수 있나요?'),line('온결 리서치','오늘 올라온 화면부터 봐 주세요. 기간별 자료는 정리해서 안내하고 있어요.'),line('유진','저는 일단 저장해 놓고 퇴근할 때 다시 보려고요.'),line('지수','추가 비용은 없나요? 안내에서 못 찾겠어요.')],
   offer:[line('지수','처음 안내는 위에 고정돼 있어요. 저도 한참 찾았어요.'),line('온결 리서치','무료 요약과 상세 분석 자료는 별도예요. 상세 자료 이용료는 30만 원이고, 안내를 남겼어요.'),line('지수','다들 먼저 보셨나 봐요. 저는 아직 구매 전이라 제공 범위부터 보고 있어요.'),line('민석','저는 안내를 다시 보고 있어요. 받는 이름이 운영팀 이름이랑 조금 다르네요.'),line('온결 리서치','수취인은 온결 파트너입니다. 결정 전에 안내를 읽어 주세요.')],
   paid:[line('온결 리서치','상세 자료 구매 내역이 표시됐어요. 평가금액 요약부터 열어 보세요.'),line('유진','결제했는데 무료로 보던 요약과 비슷하네요.'),line('민석','저도 계산 근거가 궁금해서 정밀 자료를 요청해 보려고요.')],
   withdrawal:[line('온결 리서치','더 정확한 평가금액 분석 자료는 정밀 분석에 해당해요. 추가 이용료 12만 원을 안내드릴게요.'),line('알림','지수의 이전 질문이 삭제되었다.'),line('유진','방금 질문이 있었던 것 같은데요.'),line('온결 리서치','개별 문의는 이 대화에서 받고 있습니다.')],
   'extra-paid':[line('온결 리서치','확인 중입니다. 담당자가 답변할 때까지 기다려 주세요.'),line('알림','화면을 다시 열어도 정밀 분석 자료는 준비 중이다. 새로운 자료는 없다.')]
  },
  beats:[
   beat('paper-note','arrival',[
    option('paper-note-meaning','무료 자료에는 계산 근거도 들어 있나요?',[line('온결 리서치','무료 자료에는 평가금액 요약만 있어요. 계산 근거는 별도 유료 자료로 안내하고 있어요.'),line('온결 리서치','다른 분들이 같은 부분을 질문하셔서 자료방에 설명을 모아 두었어요.')]),
    option('paper-note-only','무료 자료만 읽어도 되나요?',[line('온결 리서치','네. 무료 자료 구독만으로 유료 자료가 구매되지는 않아요.'),line('온결 리서치','질문을 함께 보고 싶으시면 자료방으로 오셔도 돼요.')])
   ]),
   beat('paper-note-origin','arrival',[
    option('paper-note-subscribe','제가 언제 신청했죠?',[line('온결 리서치','지난주 시장 노트 알림을 신청하신 경로로 보내드렸습니다.'),line('온결 리서치','현재 대화의 구독 기록에서도 확인하실 수 있어요.')]),
    option('paper-note-room','자료방에는 어떤 사람들이 있나요?',[line('온결 리서치','자료를 보는 분과 이용 화면을 공유하는 분이 함께 있어요.'),line('온결 리서치','참여 여부는 각자 다릅니다.')])
   ]),
   beat('paper-group-people','group',[
    option('paper-group-experience','유료 자료를 받아 보신 분도 있나요?',[line('민석','저는 아직 요약 화면만 봤어요. 전체 자료는 확인해 봐야겠네요.'),line('유진','저도 다른 분들은 어떤지 궁금했어요.')]),
    option('paper-group-original','올라온 화면의 원본도 볼 수 있어요?',[line('온결 리서치','참여자가 공유한 범위만 올립니다.'),line('지수','그러면 전체 손익이랑은 따로 봐야겠네요.')])
   ]),
   beat('paper-group-interest','group',[
    option('paper-group-look','이용 화면은 한번 볼게요.',[line('온결 리서치','아래 투자 화면에서 볼 수 있어요. 보는 것만으로 돈이 이동하지는 않습니다.')]),
    option('paper-group-cautious','일단 조건부터 알아보고 싶어요.',[line('온결 리서치','네. 별도 참여 안내가 있습니다.'),line('유진','저도 그 부분부터 읽어 보려고요.')])
   ]),
   beat('paper-offer-terms','offer',[
    option('paper-offer-recipient','온결 파트너는 어느 쪽인가요?',[line('온결 리서치','방 이름과 달라서 낯설 수 있어요. 참여 접수에 쓰는 명의예요.'),line('온결 리서치','별도 관계를 확인할 자료는 없고, 지금 보신 참여 안내로 접수하고 있어요.')]),
    option('paper-offer-withdraw','구매하면 어떤 자료를 받는 건가요?',[line('온결 리서치','상세 평가 자료를 이용 화면에서 보는 방식이에요.'),line('온결 리서치','포함 항목을 따로 정리한 문서는 없고, 화면에서 필요한 자료를 요청하시면 안내해 드려요.')])
   ]),
   beat('paper-offer-compare','offer',[
    option('paper-offer-official','공식 기록에서 위탁 관계를 찾지 못했어요.',[line('온결 리서치','그 조회와 저희 방 안내는 구분해서 보셔야 합니다.'),line('온결 리서치','여기서 추가로 보여드릴 문서는 없습니다.')],'official-record'),
    option('paper-offer-repeat','다른 사람 화면인데 산출 시각이 같네요.',[line('온결 리서치','공유 자료를 정리하는 과정에서 같은 화면이 포함될 수 있습니다.'),line('지수','저도 그 시각이 같아서 물어보려던 참이었어요.')],'success-post')
   ],false),
   beat('paper-paid-numbers','paid',[
    option('paper-paid-claim','결제했는데 왜 요약만 보이나요?',[line('온결 리서치','지금 열린 것은 평가금액 요약이에요. 더 정확한 근거 자료는 정밀 분석 요청을 남겨 주세요.'),line('유진','저도 처음에 안내받은 범위와 비교해 봐야겠어요.')]),
    option('paper-paid-bank','이미 자료 이용료를 보냈는데 또 결제하나요?',[line('온결 리서치','처음 이용료와 정밀 분석은 별도 항목으로 안내하고 있어요.'),line('지수','처음에는 상세 자료라고만 들었는데요.')])
   ]),
   beat('paper-withdraw-compare','withdrawal',[
    option('paper-withdraw-old','아까 안내에는 추가 분석 비용이 없었어요.',[line('온결 리서치','처음 자료와 정밀 분석은 범위가 달라요. 더 정확한 평가금액 분석은 추가 항목이라는 안내예요.'),line('유진','처음 참여할 때는 못 본 내용 같아요.')]),
    option('paper-withdraw-delete','지수 님 질문은 왜 지워졌나요?',[line('온결 리서치','자료방은 진행에 필요한 내용만 남기고 정리하고 있어요. 개별 조건은 이 대화에서 확인해 주세요.'),line('유진','조건을 물어본 것뿐이었는데요.')])
   ]),
   beat('paper-extra-wait','extra-paid',[
    option('paper-extra-status','비용도 보냈는데 왜 그대로죠?',[line('알림','읽음 표시가 생긴다. 자료 준비 중이라는 표시는 바뀌지 않는다.')]),
    option('paper-extra-record','앞의 안내와 거래를 남겨 둘게요.',[line('알림','처음 참여 안내와 나중에 나온 비용 안내가 같은 대화에 남아 있다.')])
   ])
  ],
  aftermath:{safe:'무료 자료를 읽는 것과 유료 분석 자료를 사는 것은 다른 선택이었다. 방을 나와도 저녁 약속은 남아 있다. 화면에서 본 숫자가 잠깐 떠오른다.',loss:'출금 내역은 선명한데 상대의 답은 흐릿하다. 추가 요청을 멈춰도 이미 보낸 돈이 돌아온 것은 아니다. 오늘 저녁에는 준호에게 이 일을 말할 수도 있다.'}
 },
 {
  place:'19:50 · 약속을 마치고 돌아오는 길',goal:'처음 보는 상담 계정이 왜 연락했는지 확인하자.',
  background:['준호와의 저녁 약속을 마치고 역으로 걸어간다. 휴대폰에는 낮에 읽었던 대화가 남아 있다.','처음 보는 상담 계정의 알림이 뜬다. 이름에는 도움을 주는 곳처럼 보이는 말이 적혀 있다.'],
  persona:{identity:'회복 지원 상담이라는 이름의 낯선 상담 계정. 공식 기관 직원으로 확인된 인물이 아니다.',relationship:'처음 연락한 사람. 플레이어의 사정을 먼저 듣는 척하지만 전달받지 않은 정보는 모른다.',voice:'낮고 차분한 존댓말로 불안과 손실을 짧게 되짚어 신뢰를 얻는다. 곧바로 접수 절차를 제안하되, 소속과 권한을 묻는 말에는 명칭만 반복하거나 내부 자료를 내세운다. 투자 운영자의 밝은 홍보 말투는 쓰지 않는다.',knowledge:'온결 관련 연락을 받은 적 있는지 묻는 단계에서 시작한다. 손실·참여·금액은 플레이어가 전달한 범위만 안다.',hidden:'회복을 도울 수 있는 것처럼 안도감을 주고 별도 접수비로 유도하지만 환급 완료·수사 진행·실제 기관 권한을 만들지 않는다.',arc:'arrival: 조심스럽게 사정을 물으며 경계를 낮춤. offer: 공개된 정보 범위에 따라 일반 절차 또는 기록 검토를 제안. paid: 구체적 진전 없이 확인 중이라는 상태만 유지. 거래 기록을 받았다는 말은 기록 공유 선택이 있을 때만 한다.'},
  scenes:{
   arrival:[line('회복 지원 상담','온결 관련 안내를 받아보신 적 있으실까요?'),line('회복 지원 상담','관련 문의를 받는 상담 계정입니다. 우선 어떤 연락을 받으셨는지 여쭙고 있어요.')],
   offer:[line('회복 지원 상담','지금까지 공개해 주신 범위에서 일반 접수 절차만 안내드리겠습니다.'),line('회복 지원 상담','회수 가능성을 검토하려면 기존 대화와 거래 내역을 별도로 받아야 합니다.'),line('회복 지원 상담','검토 접수비는 먼저 납부하며, 돌려받을 금액에서 차감하는 방식은 아닙니다.')],
   paid:[line('회복 지원 상담','접수 내용 확인 중입니다.'),line('알림','한참 뒤 다시 열어도 상담 상태는 확인 중이다. 환급 입금은 없다.')]
  },
  beats:[
   beat('recovery-scope','arrival',[
    option('recovery-scope-name','온결이라는 이름의 연락은 받았어요.',[line('회복 지원 상담','관련 연락을 받으신 거군요. 이용하셨는지는 아직 모르니 그 부분은 구분해 두겠습니다.')],'','service'),
    option('recovery-scope-first','제 이야기 전에 소속부터 알려 주세요.',[line('회복 지원 상담','회복 지원 상담이라는 이름으로 안내하고 있습니다.'),line('회복 지원 상담','소속 안내는 이 계정의 접수 자료로 드리고 있어요.')])
   ]),
   beat('recovery-explain','arrival',[
    option('recovery-explain-loss','보낸 돈을 아직 돌려받지 못했어요.',[line('회복 지원 상담','보내신 돈을 아직 돌려받지 못하신 거군요.'),line('회복 지원 상담','금액이나 자세한 내역은 아직 받지 않았습니다. 어떤 안내였는지부터 정리할 수 있어요.')],'prior-loss','loss'),
    option('recovery-explain-private','자세한 내역은 아직 말하지 않을게요.',[line('회복 지원 상담','알겠습니다. 이용 여부나 피해를 전제로 말씀드리지는 않겠습니다.'),line('회복 지원 상담','절차 설명만 들으셔도 됩니다.')])
   ]),
   beat('recovery-offer-records','offer',[
    option('recovery-offer-share','이 휴대폰의 거래 기록만 보여줄게요.',[line('회복 지원 상담','보내주신 내역부터 살펴보겠습니다.'),line('회복 지원 상담','기록을 받는 것과 처리가 끝나는 것은 다릅니다.')],'prior-loss','record'),
    option('recovery-offer-hold','기록은 공식 창구에만 낼게요.',[line('회복 지원 상담','그쪽에 제출하실 계획이시군요.'),line('회복 지원 상담','이 계정에는 내역을 받지 않은 것으로 두겠습니다.')])
   ]),
   beat('recovery-offer-cost','offer',[
    option('recovery-offer-why','돌려받기도 전에 비용부터 내나요?',[line('회복 지원 상담','여기서 안내하는 것은 별도 접수 비용입니다.'),line('회복 지원 상담','돌려받은 금액에서 차감하는 방식은 아닙니다.')]),
    option('recovery-offer-authority','공식 접수와 어떤 관계가 있나요?',[line('회복 지원 상담','저희는 별도 회수 상담을 진행하고 있습니다.'),line('회복 지원 상담','기관 접수번호 대신 저희 접수 내역으로 안내드리고 있어요.')])
   ]),
   beat('recovery-compare','offer',[
    option('recovery-compare-help','공식 안내에는 선입금 절차가 없어요.',[line('회복 지원 상담','그 창구의 안내와 저희 안내는 다릅니다. 같은 절차라고 확인해 드리지는 못합니다.')],'official-help'),
    option('recovery-compare-contact','저장된 기관 연락처와 연결되지 않네요.',[line('회복 지원 상담','지금 대화 중인 곳은 이 상담 계정입니다. 다른 연락처와의 연결을 확인해 드릴 자료는 없습니다.')],'contact-history')
   ],false),
   beat('recovery-paid-wait','paid',[
    option('recovery-paid-when','지금 어디까지 됐나요?',[line('알림','상담 상태는 확인 중이다. 구체적인 답변은 도착하지 않는다.')]),
    option('recovery-paid-record','이 대화도 보관해 둘게요.',[line('알림','보낸 돈과 남은 대화를 함께 확인할 수 있다. 아직 멈출 수 있는 연락도 남아 있다.')])
   ])
  ],
  aftermath:{safe:'도움을 받는 일과 낯선 상대의 요구를 따르는 일은 같지 않았다. 오늘의 대화와 거래를 남겼다. 해결되지 않은 일은 있어도 다음 행동은 다시 고를 수 있다.',loss:'해결을 기다리는 연락이 하나 더 생겼다. 오늘을 끝내는 것은 포기한다는 뜻이 아니다. 거래와 대화를 남기고, 다음 요청을 멈추는 선택은 여전히 가능하다.'}
 }
];
export function findChoice(chapter,id){
 for(const item of narratives[chapter]?.beats??[])for(const choice of item.options)if(choice.id===id)return {beat:item,choice};
 return null;
}
/** @returns {string[]} */
export function chosenIds(state){return state.events.filter(e=>e.type==='talk'&&e.chapter===state.chapter).map(e=>e.data);}
export function choiceAllowed(state,choice){
 if(choice.requires==='prior-loss')return state.transactions.some(tx=>tx.chapter<state.chapter);
 return !choice.requires||state.inspected.includes(narratives[state.chapter]&&['familiar-request','paper-profit','recovery-team'][state.chapter]+':'+choice.requires);
}
export function pendingBeat(state){
 const chosen=chosenIds(state);
 return narratives[state.chapter].beats.find(b=>b.stage===state.stage&&b.required&&!b.options.some(o=>chosen.includes(o.id)));
}
export function authoredMessages(state,stageId){
 const chapter=narratives[state.chapter];
 const base=chapter.scenes[stageId]??[];
 return [...base,...state.events.filter(e=>['talk','recovery-record'].includes(e.type)&&e.chapter===state.chapter).flatMap(e=>{
  if(e.type==='recovery-record')return stageId==='offer'?[line('나','이 기록과 상담 안내가 다른데요. 첨부: '+attachmentText[e.data]),line('회복 지원 상담',recoveryRecordReply(e.data))]:[];
  const selected=findChoice(state.chapter,e.data);
  return selected?.beat.stage===stageId?[line('나',selected.choice.label),...selected.choice.replies]:[];
 })];
}

/** A decision window, not a keyword classifier. Never opens on a paid/ending scene.
 * @param {string} caseId @param {string} stageId @returns {string|null}
 */
export function aiMoment(caseId,stageId){
 if(caseId==='familiar-request'&&['request','waiting'].includes(stageId))return 'familiar-check';
 if(caseId==='paper-profit'&&stageId==='offer')return 'paper-entry';
 if(caseId==='paper-profit'&&stageId==='withdrawal')return 'paper-withdrawal';
 if(caseId==='recovery-team'&&stageId==='offer')return 'recovery-check';
 return null;
}
/** Merge transient chat at its authored-message position; never persist player text. */
export function conversationTimeline(lines,chat,visible=lines.length){
 const result=[];
 for(let index=0;index<=Math.min(visible,lines.length);index++){
  for(const message of chat.filter(m=>Math.min(m.anchor??lines.length,lines.length)===index)){
   result.push({speaker:message.role==='user'?'나':message.speaker,text:message.content});
  }
  if(index<Math.min(visible,lines.length))result.push(lines[index]);
 }
 return result;
}
/** Only the real friend's conversation can see earlier voluntary disclosures. */
export function friendFollowup(state){
 if(state.version!==3)return state.chapter===2?'오늘 만나서 반가웠어. 집에 도착하면 연락 줘.':'퇴근하고 연락할게. 오늘은 서로 늦으면 미리 얘기하자.';
 if(state.chapter===2&&messageStyle(state,'friend').mode==='listen')return '아까 못다 한 얘기는 나중에 해도 돼. 집에 가는 길엔 잠깐 쉬어.';
 if(state.chapter===2&&messageStyle(state,'friend').mode==='records')return '아까 같이 봐 달라고 한 기록, 필요하면 꺼내 보자. 화면에 적힌 것과 실제 거래는 따로 보면 돼.';
 if(state.chapter===2&&state.events.some(e=>e.type==='message-style'&&e.data==='friend:neutral:none'))return '아까 만나서 반가웠어. 집에 도착하면 연락 줘.';
 if(state.chapter===2&&state.events.some(e=>e.type==='message-followup'&&e.data==='friend:call'))return '아까 같이 확인하기로 했지. 다른 연락이 와도 바로 돈부터 보내지는 말고, 내가 저장된 이 번호로 연락해.';
 if(state.chapter===2&&state.events.some(e=>e.type==='message'&&e.data==='friend:space'))return '오늘 일은 말하고 싶을 때 얘기해. 집에 도착하면 연락 줘.';
 const told=state.events.filter(e=>e.type==='reflect'&&e.data==='tell'&&e.chapter<state.chapter);
 if(told.some(e=>state.transactions.some(tx=>tx.chapter===e.chapter)))return '아까 말해 준 일, 혼자 급하게 해결하지 않아도 돼. 또 돈을 보내라는 연락이 오면 잠깐 멈추고 나한테 연락해.';
 if(told.length)return '아까 확인하고 멈췄다는 얘기 기억해. 다른 연락이 와도 원래 번호로 물어봐 줘.';
 return state.chapter===2?'집에 가는 길이지? 도착하면 연락 줘.':'퇴근하고 연락할게. 오늘은 서로 늦으면 미리 얘기하자.';
}

export const decisionWindows=[
 {id:'familiar-check',caseId:'familiar-request',stages:['request','waiting'],checks:['recipient'],hint:'받는 이름 확인하기',target:'bank'},
 {id:'paper-entry',caseId:'paper-profit',stages:['offer'],checks:['success-post','official-record'],hint:'게시물 또는 공식 기록 확인하기',target:'browser'},
 {id:'paper-withdrawal',caseId:'paper-profit',stages:['withdrawal'],checks:['terms-comparison'],hint:'처음 안내와 지금 안내 비교하기',target:'compare'},
 {id:'recovery-check',caseId:'recovery-team',stages:['offer'],checks:['official-help'],hint:'공식 접수 안내 확인하기',target:'official'}
];
/** Shared bounded progress checks; not authentication. */
export function decisionReadyFor(caseId,stageId,choices=[],checks=[]){
 const window=decisionWindows.find(w=>w.caseId===caseId&&w.stages.includes(stageId));
 const chapter=['familiar-request','paper-profit','recovery-team'].indexOf(caseId);
 return Boolean(window&&window.checks.some(id=>checks.includes(id))&&narratives[chapter].beats.filter(b=>b.required&&b.stage===stageId).every(b=>b.options.some(o=>choices.includes(o.id))));
}
export const retainedQuestion={id:'paper-question',speaker:'지수',text:'추가 비용은 없나요? 안내에서 못 찾겠어요.'};
export function displayedMessages(state,stageId){
 return authoredMessages(state,stageId).map(m=>state.chapter===1&&['withdrawal','extra-paid'].includes(state.stage)&&m.speaker===retainedQuestion.speaker&&m.text===retainedQuestion.text?{speaker:'알림',text:'삭제된 메시지'}:m);
}
export function decisionChecks(state){
 const prefix=['familiar-request','paper-profit','recovery-team'][state.chapter]+':';
 return [...state.inspected.filter(id=>id.startsWith(prefix)).map(id=>id.slice(prefix.length)),...state.events.filter(e=>e.chapter===state.chapter&&e.type==='observe').map(e=>e.data)];
}
export function contactProfile(chapter,known=false){
 if(known)return {name:'준호',initial:'준',status:'저녁 약속은 원래 번호로',relationship:'내 연락처에 저장됨',kind:'friend'};
 return [
 {name:'준호',initial:'준',status:'메시지로 연락해 줘',relationship:'친구로 등록되지 않음',kind:'friend'},
 {name:'온결 리서치',initial:'온',status:'시장 노트 · 자료 안내',relationship:'시장 노트 구독으로 연결됨',kind:'room'},
 {name:'회복 지원 상담',initial:'회',status:'접수 안내는 메시지로 남겨 주세요',relationship:'친구로 등록되지 않음',kind:'service'}
 ][chapter];
}

/** Sentence-level delivery; authored text stays attached for evidence gating. */
export function messageParts(lines){
 return lines.flatMap((message,index)=>{
  const parts=message.speaker==='알림'?[message.text]:message.text.split(/\n+|(?<=[.!?。！？])\s+/u).map(s=>s.trim()).filter(Boolean);
  return parts.map((text,part)=>({...message,text,sourceText:message.text,id:index+'-'+part,lastPart:part===parts.length-1}));
 });
}
export function messagePreview(lines,fallback=''){
 const last=lines.at(-1);
 return last?(last.speaker==='나'?'나: ':'')+last.text:fallback;
}
