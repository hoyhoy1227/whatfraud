import assert from 'node:assert/strict';
import {appendMessageTranscript,emptyMessageMemory,messageTranscript,resetMessageMemory} from '../../app/story/presentation.js';

const first=appendMessageTranscript(emptyMessageMemory(),[
 {speaker:'나',text:'첫 메시지'},
 {speaker:'지수',text:'첫 답변'}
],'지수');
const afterTransfer=appendMessageTranscript({...emptyMessageMemory(),transcript:first},[
 {speaker:'나',text:'송금 후 메시지',attachment:'terms-note'},
 {speaker:'지수',text:'송금 후 답변'}
],'지수');
const secondFollowup=appendMessageTranscript({...emptyMessageMemory(),transcript:afterTransfer},[
 {speaker:'나',text:'두 번째 후속 메시지'},
 {speaker:'지수',text:'두 번째 후속 답변'}
],'지수');
assert.deepEqual(secondFollowup.map(entry=>entry.text),['첫 메시지','첫 답변','송금 후 메시지','송금 후 답변','두 번째 후속 메시지','두 번째 후속 답변']);
assert.equal(new Set(secondFollowup.map(entry=>entry.id)).size,secondFollowup.length,'message ids remain stable and unique');
assert.equal(secondFollowup[2].attachment,'terms-note');

const legacy={draft:'',sent:'기존 사용자 메시지',reply:'기존 AI 답변',attachment:'none',sentAttachment:'first-notice',preparedSent:'기존 준비 메시지',callStep:0};
assert.deepEqual(messageTranscript(legacy,'지수').map(entry=>entry.text),['기존 사용자 메시지','기존 AI 답변','기존 준비 메시지']);
assert.equal(messageTranscript(legacy,'지수')[0].attachment,'first-notice');

const peer={...emptyMessageMemory(),transcript:first};
const friend={...emptyMessageMemory(),transcript:appendMessageTranscript(emptyMessageMemory(),[{speaker:'나',text:'준호에게 보낸 말'},{speaker:'준호',text:'준호 답장'}],'준호')};
assert.deepEqual(messageTranscript(peer,'지수').map(entry=>entry.text),['첫 메시지','첫 답변']);
assert.deepEqual(messageTranscript(friend,'준호').map(entry=>entry.text),['준호에게 보낸 말','준호 답장']);
const isolated={'full:1:peer':peer,'full:0:friend':friend,'demo:1:peer':emptyMessageMemory(),'practice:full:1:peer':emptyMessageMemory()};
assert.deepEqual(Object.keys(resetMessageMemory(isolated,'demo')).sort(),['full:0:friend','full:1:peer']);
console.log('Message transcript ordering, legacy migration and conversation isolation passed.');
