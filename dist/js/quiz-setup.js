import {randomizeQuestions} from './quiz-order.js';
export function validateQuizSetup(count,minutes,available){
 const questionCount=Number(count),timeMinutes=Number(minutes);
 if(!Number.isInteger(questionCount)||questionCount<1||questionCount>available)throw new Error(`Choose a whole number of questions from 1 to ${available}.`);
 if(!Number.isInteger(timeMinutes)||timeMinutes<1||timeMinutes>180)throw new Error('Choose a whole number of minutes from 1 to 180.');
 return {questionCount,timeMinutes};
}
export function selectQuizQuestions(bank,count,previousOrder=[],random=Math.random){
 const {questionCount}=validateQuizSetup(count,1,bank.length),shuffled=randomizeQuestions(bank,[],random),selected=shuffled.slice(0,questionCount);
 if(selected.length===previousOrder.length&&selected.every((q,i)=>String(q.id)===String(previousOrder[i]))&&shuffled.length>1){if(selected.length>1)selected.push(selected.shift());else selected[0]=shuffled[1];}
 return selected;
}
