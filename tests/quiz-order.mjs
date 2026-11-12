import assert from 'node:assert/strict';
import {randomizeQuestions} from '../dist/js/quiz-order.js';
const questions=Array.from({length:8},(_,index)=>({id:'q'+index,options:['A','B','C','D'],correct_index:index%4})),original=JSON.stringify(questions);
let order=questions.map(q=>q.id);
for(let attempt=0;attempt<20;attempt++){const next=randomizeQuestions(questions,order,()=>0.999);assert.notDeepEqual(next.map(q=>q.id),order);assert.deepEqual([...next.map(q=>q.id)].sort(),questions.map(q=>q.id).sort());for(const q of next)assert.equal(q.correct_index,questions.find(x=>x.id===q.id).correct_index);order=next.map(q=>q.id);}
assert.equal(JSON.stringify(questions),original);assert.deepEqual(randomizeQuestions([],[]),[]);assert.deepEqual(randomizeQuestions([questions[0]],['q0']),[questions[0]]);const two=questions.slice(0,2);assert.notDeepEqual(randomizeQuestions(two,two.map(q=>q.id),()=>0.999).map(q=>q.id),two.map(q=>q.id));
console.log('PASS: random order without duplicates, forced different retakes, immutable question bank, correct-answer alignment, and single/empty quiz handling.');
