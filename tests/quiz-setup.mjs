import assert from 'node:assert/strict';
import {validateQuizSetup,selectQuizQuestions} from '../dist/js/quiz-setup.js';
const bank=Array.from({length:10},(_,i)=>({id:'q'+i,correct_index:i%4,options:['A','B','C','D']})),original=JSON.stringify(bank);
assert.deepEqual(validateQuizSetup('3','12',10),{questionCount:3,timeMinutes:12});
for(const count of [0,-1,11,1.5,'','abc',Infinity])assert.throws(()=>validateQuizSetup(count,10,10));
for(const time of [0,-1,181,1.5,'','abc',Infinity])assert.throws(()=>validateQuizSetup(3,time,10));
assert.throws(()=>selectQuizQuestions([],1));
let previous=[];for(let i=0;i<20;i++){const questions=selectQuizQuestions(bank,3,previous,()=>0.999);assert.equal(questions.length,3);assert.equal(new Set(questions.map(q=>q.id)).size,3);if(previous.length)assert.notDeepEqual(questions.map(q=>q.id),previous);for(const q of questions)assert.equal(q.correct_index,bank.find(item=>item.id===q.id).correct_index);previous=questions.map(q=>q.id);}
const one=selectQuizQuestions(bank,1,[],()=>0.999),next=selectQuizQuestions(bank,1,one.map(q=>q.id),()=>0.999);assert.notEqual(one[0].id,next[0].id);assert.equal(selectQuizQuestions([bank[0]],1,['q0'])[0].id,'q0');assert.equal(JSON.stringify(bank),original);
console.log('PASS: selected question counts, integer/time boundaries, random unique subsets, different retakes and correct-answer preservation.');
