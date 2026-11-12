// Shuffle a copy so the shared question bank and correct-answer indices stay intact.
export function randomizeQuestions(questions,previousOrder=[],random=Math.random){
 const result=[...questions];
 for(let index=result.length-1;index>0;index--){const target=Math.min(index,Math.max(0,Math.floor(random()*(index+1))));[result[index],result[target]]=[result[target],result[index]];}
 if(result.length>1&&result.length===previousOrder.length&&result.every((item,index)=>String(item.id)===String(previousOrder[index]))){const shift=1+Math.min(result.length-2,Math.max(0,Math.floor(random()*(result.length-1))));result.push(...result.splice(0,shift));}
 return result;
}
