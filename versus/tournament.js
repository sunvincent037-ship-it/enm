(function(root){
 'use strict';
 const DV=root.DV=root.DV||{};
 const pick=(length,random)=>Math.min(length-1,Math.max(0,Math.floor(random()*length)));
 const shuffle=(items,random)=>{
  const result=items.slice();
  for(let i=result.length-1;i>0;i--){const j=pick(i+1,random);[result[i],result[j]]=[result[j],result[i]];}
  return result;
 };
 const identity=spec=>spec?.characterId||spec?.id;
 const matches=slots=>Array.from({length:slots.length/2},(_,i)=>({slots:slots.slice(i*2,i*2+2),winner:null}));
 const rating=spec=>{
  const {health,speed,power}=spec?.stats||{};
  return [health,speed,power].every(value=>Number.isFinite(value)&&value>0)
   ?health*power*Math.sqrt(speed/314):null;
 };
 const unplayedWinner=(match,random,roster)=>{
  const [first,second]=match.slots;
  const a=rating(roster?.[first]),b=rating(roster?.[second]);
  const chance=a&&b?Math.max(.2,Math.min(.8,.5+2*(a-b)/(a+b))):.5;
  return random()<chance?first:second;
 };

 function createTournament(roster,playerIndex,options={},random=Math.random){
  if(!Array.isArray(roster)||!Number.isInteger(playerIndex)||!roster[playerIndex])throw new Error('无效的参赛角色');
  const playerId=identity(roster[playerIndex]);
  const groups=new Map();
  roster.forEach((spec,index)=>{const id=identity(spec);if(id!==playerId){if(!groups.has(id))groups.set(id,[]);groups.get(id).push(index);}});
  if(groups.size<7)throw new Error('参赛角色不足八人');
  const opponents=shuffle([...groups.values()],random).slice(0,7).map(indices=>indices[pick(indices.length,random)]);
  const entrants=shuffle([playerIndex,...opponents],random);
  return {version:2,playerIndex,assistIndex:Number.isInteger(options.assistIndex)?options.assistIndex:playerIndex,
   difficulty:['easy','normal','hard','inferno'].includes(options.difficulty)?options.difficulty:'normal',
   stageIndex:Number.isInteger(options.stageIndex)&&options.stageIndex>=0?options.stageIndex:0,
   format:options.format==='bo3'?'bo3':'single',timer:options.timer==='infinite'?'infinite':'99',
   duel:{playerWins:0,opponentWins:0,games:[]},history:[],
   round:0,status:'active',rounds:[matches(entrants),matches([null,null,null,null]),matches([null,null])]};
 }

 function currentOpponent(cup){
  if(cup?.status!=='active')return null;
  const match=cup.rounds?.[cup.round]?.find(item=>item.slots.includes(cup.playerIndex));
  if(!match||match.winner!==null)return null;
  return match.slots.find(index=>index!==cup.playerIndex)??null;
 }

 function settleTournament(cup,result,random=Math.random,roster){
  if(!['win','loss','draw'].includes(result))throw new Error('无效的赛果');
  if(result==='draw')return cup;
  const next=JSON.parse(JSON.stringify(cup));
  const opponent=currentOpponent(next);
  if(opponent===null)throw new Error('赛程中没有待打的对局');
  if(result==='win')next.duel.playerWins++;
  else next.duel.opponentWins++;
  next.duel.games.push(result==='win'?0:1);
  const needed=next.format==='bo3'?2:1;
  if(next.duel.playerWins<needed&&next.duel.opponentWins<needed)return next;
  next.history.push({round:next.round,opponentIndex:opponent,score:[next.duel.playerWins,next.duel.opponentWins],games:next.duel.games.slice()});
  next.duel={playerWins:0,opponentWins:0,games:[]};
  const current=next.rounds[next.round];
  for(const match of current){
   if(match.slots.includes(next.playerIndex))match.winner=result==='win'?next.playerIndex:opponent;
   else match.winner=unplayedWinner(match,random,roster);
  }
  if(result==='loss'){next.status='eliminated';return next;}
  if(next.round===2){next.status='champion';return next;}
  const following=next.rounds[next.round+1];
  current.forEach((match,i)=>{following[Math.floor(i/2)].slots[i%2]=match.winner;});
  next.round++;
  return next;
 }

 function upgradeTournament(cup,roster){
  if(!cup||typeof cup!=='object')return null;
  if(cup.version===2)return cup;
  if(cup.version!==1||!Array.isArray(cup.rounds)||!Array.isArray(roster))return null;
  const next=JSON.parse(JSON.stringify(cup));
  next.version=2;next.format='single';next.timer='99';next.duel={playerWins:0,opponentWins:0,games:[]};next.history=[];
  const completed=next.round+(next.status==='active'?0:1);
  for(let round=0;round<completed;round++){
   const match=next.rounds[round]?.find(item=>item?.slots?.includes(next.playerIndex));
   if(!match||match.winner===null)return null;
   const opponentIndex=match.slots.find(index=>index!==next.playerIndex);
   const win=match.winner===next.playerIndex;
   next.history.push({round,opponentIndex,score:win?[1,0]:[0,1],games:[win?0:1]});
  }
  return validateTournament(next,roster)?next:null;
 }

 function validateTournament(cup,roster){
  if(!cup||cup.version!==2||!Array.isArray(roster)||!Number.isInteger(cup.playerIndex)||!roster[cup.playerIndex]||
    !Number.isInteger(cup.assistIndex)||!roster[cup.assistIndex]||!Number.isInteger(cup.stageIndex)||cup.stageIndex<0||
    !['easy','normal','hard','inferno'].includes(cup.difficulty)||!Number.isInteger(cup.round)||cup.round<0||cup.round>2||
    !['easy','normal','hard','inferno'].includes(cup.difficulty)||!['single','bo3'].includes(cup.format)||!['99','infinite'].includes(cup.timer)||
    !['active','eliminated','champion'].includes(cup.status)||!Array.isArray(cup.rounds)||cup.rounds.length!==3||
    !Array.isArray(cup.history)||!cup.duel||!Array.isArray(cup.duel.games))return false;
  const sizes=[4,2,1];
  for(let round=0;round<3;round++){
   const matchesInRound=cup.rounds[round];
   if(!Array.isArray(matchesInRound)||matchesInRound.length!==sizes[round])return false;
   for(let i=0;i<matchesInRound.length;i++){
    const match=matchesInRound[i];
    if(!match||!Array.isArray(match.slots)||match.slots.length!==2)return false;
    for(let slot=0;slot<2;slot++){
     const index=match.slots[slot];
     if(round===0&&index===null)return false;
     const expected=round===0?undefined:cup.rounds[round-1][i*2+slot]?.winner;
     if(round>0&&index!==(round>cup.round?null:expected))return false;
     if(index!==null&&(!Number.isInteger(index)||!roster[index]))return false;
    }
    if(match.winner!==null&&!match.slots.includes(match.winner))return false;
    if(round<cup.round&&match.winner===null)return false;
    if(round>cup.round&&match.winner!==null)return false;
   }
  }
  const entrants=cup.rounds[0].flatMap(match=>match.slots);
  if(new Set(entrants.map(index=>identity(roster[index]))).size!==8||entrants.filter(index=>index===cup.playerIndex).length!==1)return false;
  const playerMatch=cup.rounds[cup.round].find(match=>match.slots.includes(cup.playerIndex));
  if(!playerMatch)return false;
  const needed=cup.format==='bo3'?2:1;
  const validScore=(score,games)=>{
   if(!Array.isArray(score)||score.length!==2||!score.every(n=>Number.isInteger(n)&&n>=0&&n<=needed)||
     !Array.isArray(games)||games.length!==score[0]+score[1])return false;
   const wins=[0,0];
   for(const winner of games){
    if((winner!==0&&winner!==1)||wins.some(n=>n===needed))return false;
    wins[winner]++;
   }
   return wins[0]===score[0]&&wins[1]===score[1];
  };
  const completed=cup.round+(cup.status==='active'?0:1);
  if(cup.history.length!==completed)return false;
  for(let round=0;round<completed;round++){
   const record=cup.history[round],match=cup.rounds[round].find(item=>item.slots.includes(cup.playerIndex));
   if(!record||!match||record.round!==round||record.opponentIndex!==match.slots.find(index=>index!==cup.playerIndex)||
    !validScore(record.score,record.games)||Math.max(...record.score)!==needed||
    match.winner!==(record.score[0]===needed?cup.playerIndex:record.opponentIndex))return false;
  }
  if(!validScore([cup.duel.playerWins,cup.duel.opponentWins],cup.duel.games))return false;
  if(cup.status==='active')return playerMatch.winner===null&&currentOpponent(cup)!==null&&
   cup.duel.playerWins<needed&&cup.duel.opponentWins<needed;
  if(cup.duel.games.length!==0)return false;
  if(cup.status==='champion')return cup.round===2&&playerMatch.winner===cup.playerIndex;
  return playerMatch.winner!==null&&playerMatch.winner!==cup.playerIndex;
 }
 Object.assign(DV,{createTournament,currentOpponent,settleTournament,validateTournament,upgradeTournament});
 if(typeof module!=='undefined'&&module.exports)module.exports={createTournament,currentOpponent,settleTournament,validateTournament,upgradeTournament};
})(typeof globalThis!=='undefined'?globalThis:window);
