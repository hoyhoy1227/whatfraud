/** Derived from replayable events, never from an NPC's claim or saved booleans.
 * @typedef {{investmentContacted:boolean,investmentTransferred:boolean,fakeProfitViewed:boolean,withdrawalBlocked:boolean,recoveryContactClaimsKnowledge:boolean}} FraudContext
 */
export function fraudContext(state){
 return {
  investmentContacted:state.events.some(e=>e.chapter===1),
  investmentTransferred:state.transactions.some(t=>t.id==='paper-profit:main'),
  fakeProfitViewed:state.events.some(e=>e.chapter===1&&(e.type==='observe'&&e.data==='platform-view'||e.type==='inspect'&&e.data==='paper-profit:profit-report')),
  withdrawalBlocked:state.events.some(e=>e.chapter===1&&e.type==='withdraw'),
  recoveryContactClaimsKnowledge:state.chapter===2
 };
}
export function recoveryClaim(state){
 const context=fraudContext(state);
 return context.withdrawalBlocked?'온결 출금 관련 문의 이력이 있다고 전달받았습니다. 피해금 회복 상담이 필요한지 확인하려고 연락드렸습니다.'
 :context.investmentTransferred?'온결 참여 관련 처리 대상이라고 전달받았습니다. 피해금 회복 상담이 필요한지 확인하려고 연락드렸습니다.'
 :context.investmentContacted?'온결 자료 안내를 받으신 분이라고 전달받았습니다. 피해가 있으신지는 아직 몰라 상담이 필요한지 여쭙고 있습니다.'
 :'온결 관련 상담 안내 대상이라고 전달받았습니다. 실제 이용이나 피해 여부는 아직 확인하지 못했습니다.';
}
export const sourceLabels={
 'sender-attachment':'상대방이 보낸 자료',
 'sender-message':'발신자 주장·공식 확인 전',
 'independent-record':'독립 확인 기록',
 'player-record':'플레이어가 직접 확인한 기록'
};
