const COUNTRIES = [
  { id:50,name:"Bangladesh",capital:"Dhaka",region:"South Asia",aliases:[] },
  { id:64,name:"Bhutan",capital:"Thimphu",region:"South Asia",aliases:[] },
  { id:96,name:"Brunei",capital:"Bandar Seri Begawan",region:"Southeast Asia",marker:[114.94,4.54],aliases:[] },
  { id:116,name:"Cambodia",capital:"Phnom Penh",region:"Southeast Asia",aliases:[] },
  { id:156,name:"China",capital:"Beijing",region:"East Asia",aliases:["People's Republic of China","PRC"] },
  { id:626,name:"East Timor",capital:"Dili",region:"Southeast Asia",marker:[125.73,-8.87],aliases:["Timor-Leste","Timor Leste"] },
  { id:356,name:"India",capital:"New Delhi",region:"South Asia",aliases:[] },
  { id:360,name:"Indonesia",capital:"Jakarta",region:"Southeast Asia",aliases:[] },
  { id:392,name:"Japan",capital:"Tokyo",region:"East Asia",aliases:[] },
  { id:418,name:"Laos",capital:"Vientiane",region:"Southeast Asia",aliases:["Lao PDR"] },
  { id:458,name:"Malaysia",capital:"Kuala Lumpur",region:"Southeast Asia",aliases:[] },
  { id:462,name:"Maldives",capital:"Malé",region:"South Asia",marker:[73.5,3.2],aliases:[] },
  { id:496,name:"Mongolia",capital:"Ulaanbaatar",region:"East Asia",aliases:[] },
  { id:104,name:"Myanmar",capital:"Naypyidaw",region:"Southeast Asia",aliases:["Burma"] },
  { id:524,name:"Nepal",capital:"Kathmandu",region:"South Asia",aliases:[] },
  { id:408,name:"North Korea",capital:"Pyongyang",region:"East Asia",aliases:["DPRK"] },
  { id:608,name:"Philippines",capital:"Manila",region:"Southeast Asia",aliases:[] },
  { id:702,name:"Singapore",capital:"Singapore",region:"Southeast Asia",marker:[103.82,1.35],aliases:[] },
  { id:410,name:"South Korea",capital:"Seoul",region:"East Asia",aliases:["Republic of Korea","Korea"] },
  { id:144,name:"Sri Lanka",capital:"Sri Jayawardenepura Kotte",region:"South Asia",aliases:["Ceylon"] },
  { id:158,name:"Taiwan",capital:"Taipei",region:"East Asia",aliases:[] },
  { id:764,name:"Thailand",capital:"Bangkok",region:"Southeast Asia",aliases:[] },
  { id:704,name:"Vietnam",capital:"Hanoi",region:"Southeast Asia",aliases:["Viet Nam"] }
];

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const state = { mode:"pin",active:false,score:0,attempts:0,mistakes:0,index:0,order:[],current:null,elapsed:0,timer:null,mapReady:false,sound:true,completed:new Set(),resolved:new Set(),revealed:new Set(),wrong:new Set(),triesByCountry:new Map() };
const storage = {
  read(key,fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  write(key,value){ localStorage.setItem(key,JSON.stringify(value)); }
};

function shuffle(items){ const copy=[...items]; for(let i=copy.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [copy[i],copy[j]]=[copy[j],copy[i]]; } return copy; }
function formatTime(seconds){ return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`; }
function escapeHtml(text){ return text.replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char])); }
function beep(success=true){
  if(!state.sound)return;
  try { const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain(); osc.frequency.value=success?620:185; gain.gain.setValueAtTime(.06,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.12); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime+.12); } catch {}
}

function setupCountryList(){
  $("#countryList").innerHTML=COUNTRIES.map((c,i)=>`<div class="country-card"><span class="country-number">${String(i+1).padStart(2,"0")}</span><span><b>${c.name}</b><small>${c.capital} · ${c.region}</small></span></div>`).join("");
}

function setupConsent(){
  const overlay=$("#consentOverlay"),button=$("#agreeButton"),countdown=$("#agreeCountdown");
  document.body.classList.add("consent-locked");
  const protectedContent=$$("body > :not(#consentOverlay):not(script)"); protectedContent.forEach(element=>element.inert=true);
  let remaining=3;
  const timer=setInterval(()=>{
    remaining--;
    if(remaining>0){ button.textContent=`I Agree · ${remaining}`; countdown.textContent=`Please read the agreement. The button unlocks in ${remaining} ${remaining===1?"second":"seconds"}.`; return; }
    clearInterval(timer); button.disabled=false; button.textContent="I Agree"; countdown.textContent="You may now accept and enter Monsoon Atlas."; button.focus();
  },1000);
  button.addEventListener("click",()=>{
    if(button.disabled)return;
    protectedContent.forEach(element=>element.inert=false); document.body.classList.remove("consent-locked"); overlay.classList.add("consent-accepted");
    setTimeout(()=>overlay.remove(),280);
  });
}

function setMode(mode){
  endTimers(); Object.assign(state,{mode,active:false,score:0,attempts:0,mistakes:0,elapsed:0,current:null}); state.completed.clear(); state.resolved.clear(); state.revealed.clear(); state.wrong.clear(); state.triesByCountry.clear();
  $("#endScreen").classList.add("hidden");
  $(".game-shell").classList.remove("is-playing");
  $(".game-shell").classList.toggle("labels-mode",mode==="labels");
  $$(".mode").forEach(button=>{ const active=button.dataset.mode===mode; button.classList.toggle("active",active); button.setAttribute("aria-selected",active); });
  $("#moreMode").classList.toggle("active",mode==="labels"||mode==="sprint");
  $("#moreMenu").classList.add("hidden"); $("#moreMode").setAttribute("aria-expanded","false");
  $("#labelTray").classList.add("hidden"); $("#labelTray").innerHTML="";
  $("#typeForm").classList.toggle("hidden",mode!=="type"); $("#skipButton").classList.add("hidden");
  $("#startButton").textContent=mode==="learn"?"Start learning":"Start quiz";
  const copy={ learn:["Study mode","Select any country","Click the map to reveal its name and capital."],pin:["Pin mode","Ready to locate?","Find each named country on the map."],type:["Type mode","Ready to identify?","Name the country highlighted on the map."],labels:["Place the labels","Choose any country","Select a country label, then place it on the map."],sprint:["Sprint mode","60 seconds","Find as many countries as you can before time runs out."] }[mode];
  setPrompt(...copy); resetMapClasses(); updateScore(); updateBest();
}

function setPrompt(kicker,title,hint){ $("#promptKicker").textContent=kicker; $("#promptText").textContent=title; $("#promptHint").textContent=hint; }

function startGame(){
  if(!state.mapReady){ showToast("The map is still loading.",false); return; }
  resetMapClasses(); Object.assign(state,{active:true,score:0,attempts:0,mistakes:0,elapsed:0,index:0,current:null,order:shuffle(COUNTRIES)}); state.completed.clear(); state.resolved.clear(); state.revealed.clear(); state.wrong.clear(); state.triesByCountry.clear();
  $("#endScreen").classList.add("hidden");
  $(".game-shell").classList.add("is-playing");
  $("#startButton").textContent="Restart";
  if(state.mode==="learn"){
    setPrompt("Study mode","Choose a country","Click anywhere in green to learn its capital."); COUNTRIES.forEach(addLabel);
  } else { $("#skipButton").classList.remove("hidden"); beginTimer(); if(state.mode==="labels")renderLabelTray(); nextQuestion(); }
  if(state.mode==="sprint"){
    state.elapsed=60; clearInterval(state.timer); state.timer=setInterval(()=>{ state.elapsed--; updateScore(); if(state.elapsed<=0)finishGame(); },1000);
  }
  updateScore();
}

function beginTimer(){ clearInterval(state.timer); state.timer=setInterval(()=>{ state.elapsed++; updateScore(); },1000); }
function endTimers(){ clearInterval(state.timer); state.timer=null; }
function nextQuestion(){
  clearHighlights(); if(!state.active)return;
  if(state.mode==="labels"){
    const remaining=COUNTRIES.filter(country=>!state.resolved.has(country.id));
    if(!remaining.length){ finishGame(); return; }
    if(!state.current||state.resolved.has(state.current.id))state.current=remaining[0];
    setPrompt("Place this label",state.current.name,"Choose another label below at any time."); updateLabelTray(); return;
  }
  while(state.index<state.order.length&&state.resolved.has(state.order[state.index].id))state.index++;
  if(state.index>=state.order.length){ finishGame(); return; }
  state.current=state.order[state.index++];
  if(state.mode==="type"){
    highlightCountry(state.current,"target"); setPrompt("Name this country","Highlighted in amber",`Question ${state.index} of ${COUNTRIES.length}`); $("#typeAnswer").value=""; $("#typeAnswer").focus();
  } else setPrompt(state.mode==="sprint"?"Quick—find":`Find · ${state.index} of ${COUNTRIES.length}`,state.current.name,`Capital: ${state.current.capital}`);
}

function handleCountryClick(country){
  if(!state.active||state.mode==="learn"){ revealLearn(country); return; }
  const answerRevealed=state.revealed.has(state.current.id);
  if(state.mode==="type"&&!answerRevealed)return;
  if(!answerRevealed||country.id===state.current.id)state.attempts++;
  if(country.id===state.current.id){ resolveCorrect(country); }
  else if(answerRevealed){ beep(false); highlightCountry(country,"wrong"); showToast(`Click the highlighted answer — ${state.current.name}.`,false); }
  else { state.mistakes++; state.wrong.add(country.id); beep(false); highlightCountry(country,"wrong"); registerMiss(`That's ${country.name}.`); }
  updateScore();
}

function resolveCorrect(country){
  const wasRevealed=state.revealed.has(country.id); state.score++; state.completed.add(country.id); state.resolved.add(country.id); beep(true); highlightCountry(country,"correct"); showToast(wasRevealed?`Found — ${country.name}. Partial accuracy credit earned.`:`Correct — ${country.name}!`,true); if(state.mode==="labels")state.current=null; setTimeout(nextQuestion,500);
}

function registerMiss(message){
  const answer=state.current,tries=(state.triesByCountry.get(answer.id)||0)+1; state.triesByCountry.set(answer.id,tries);
  if(tries<3){ showToast(`${message} ${3-tries} ${3-tries===1?"try":"tries"} left.`,false); return; }
  state.revealed.add(answer.id); state.wrong.add(answer.id); highlightCountry(answer,"target"); addLabel(answer); beep(false);
  if(state.mode==="labels")updateLabelTray();
  setPrompt("Answer revealed",answer.name,"Click the highlighted country on the map to continue.");
  showToast(`The answer is ${answer.name}. Select it to continue.`,false);
}

function revealLearn(country){ resetMapClasses(); highlightCountry(country,"target"); addLabel(country); setPrompt(country.region,country.name,`${country.capital} is the capital.`); showToast(`${country.name} · ${country.capital}`,true); }
function checkTypedAnswer(event){
  event.preventDefault(); if(!state.active||state.mode!=="type")return;
  if(state.revealed.has(state.current.id)){ showToast(`Click the highlighted answer — ${state.current.name}.`,false); return; }
  const answer=$("#typeAnswer").value.trim().toLowerCase(); if(!answer)return; state.attempts++;
  const valid=[state.current.name,...state.current.aliases].some(name=>name.toLowerCase()===answer);
  if(valid){ resolveCorrect(state.current); }
  else { state.mistakes++; beep(false); registerMiss("Not quite."); $("#typeAnswer").select(); }
  updateScore();
}

function skipQuestion(){
  if(!state.active||!state.current)return;
  const skipped=state.current;
  if(state.mode==="labels"){
    const remaining=COUNTRIES.filter(country=>!state.resolved.has(country.id)&&country.id!==skipped.id); state.current=remaining[0]||skipped;
  } else {
    state.order.push(skipped); state.current=null;
  }
  showToast(`${skipped.name} moved to later — no penalty.`,true); nextQuestion();
}

function renderLabelTray(){
  const tray=$("#labelTray"); tray.classList.remove("hidden"); tray.innerHTML="";
  COUNTRIES.forEach(country=>{
    const button=document.createElement("button"); button.type="button"; button.textContent=country.name; button.dataset.countryId=country.id;
    button.addEventListener("click",()=>{ if(state.resolved.has(country.id))return; state.current=country; setPrompt("Place this label",country.name,"Click the country on the map."); updateLabelTray(); });
    tray.appendChild(button);
  });
  updateLabelTray();
}

function updateLabelTray(){
  $$("#labelTray button").forEach(button=>{ const id=Number(button.dataset.countryId),placed=state.completed.has(id),revealed=state.revealed.has(id)&&!placed,active=state.current?.id===id; button.classList.toggle("placed",placed); button.classList.toggle("revealed",revealed); button.classList.toggle("active",active); button.disabled=state.resolved.has(id); });
}
function finishGame(){
  if(!state.active)return; state.active=false; endTimers(); $("#skipButton").classList.add("hidden");
  const total=COUNTRIES.length,accuracy=state.attempts?Math.round(state.score/state.attempts*100):0,finishedAt=new Date(),mistakes=state.mistakes;
  const attempt={mode:state.mode,score:state.score,total,accuracy,mistakes,seconds:state.mode==="sprint"?60:state.elapsed,date:finishedAt.toISOString()};
  const history=storage.read("monsoon-atlas-history",[]); history.unshift(attempt); storage.write("monsoon-atlas-history",history.slice(0,25));
  setPrompt("Quiz complete",`${state.score} correct · ${accuracy}%`,`Finished in ${formatTime(attempt.seconds)}. Your result has been saved.`); $("#startButton").textContent="Play again"; renderProgress(); updateBest();
  $("#endCompletedAt").textContent=new Intl.DateTimeFormat(undefined,{dateStyle:"full",timeStyle:"short"}).format(finishedAt);
  $("#endPercent").textContent=`${accuracy}%`; $("#endScore").textContent=`${state.score} / ${total}`; $("#endTime").textContent=formatTime(attempt.seconds); $("#endMistakes").textContent=mistakes; $("#endMode").textContent=state.mode==="labels"?"Place labels":state.mode[0].toUpperCase()+state.mode.slice(1);
  $("#endScreen").classList.remove("hidden");
}

function updateScore(){
  $("#scoreValue").textContent=state.score; $("#totalValue").textContent=state.mode==="sprint"?Math.max(state.score,state.attempts):COUNTRIES.length;
  $("#accuracyValue").textContent=state.attempts?`${Math.round(state.score/state.attempts*100)}%`:"—"; $("#timerValue").textContent=formatTime(state.elapsed);
}
function updateBest(){
  const history=storage.read("monsoon-atlas-history",[]).filter(x=>x.mode===state.mode); if(!history.length){ $("#bestValue").textContent="—"; return; }
  const best=history.sort((a,b)=>b.accuracy-a.accuracy||b.score-a.score||a.seconds-b.seconds)[0]; $("#bestValue").textContent=`${best.accuracy}%`;
}
function updateStreak(){
  const dates=[...new Set(storage.read("monsoon-atlas-history",[]).map(x=>x.date.slice(0,10)))].sort().reverse(); let streak=0;
  const cursor=new Date(); cursor.setHours(0,0,0,0); const today=cursor.toISOString().slice(0,10); if(dates[0]!==today)cursor.setDate(cursor.getDate()-1);
  for(const date of dates){ const expected=cursor.toISOString().slice(0,10); if(date===expected){ streak++; cursor.setDate(cursor.getDate()-1); } else if(date<expected)break; }
  $("#streakValue").textContent=streak;
}
function renderProgress(){
  const history=storage.read("monsoon-atlas-history",[]); $("#gamesPlayed").textContent=history.length; $("#averageAccuracy").textContent=history.length?`${Math.round(history.reduce((sum,x)=>sum+x.accuracy,0)/history.length)}%`:"—";
  if(history.length){ const best=[...history].sort((a,b)=>b.accuracy-a.accuracy||b.score-a.score||a.seconds-b.seconds)[0]; $("#overallBest").textContent=`${best.accuracy}% accuracy`; $("#overallBestMeta").textContent=`${best.score} correct in ${formatTime(best.seconds)} · ${best.mode}`; }
  else { $("#overallBest").textContent="No score yet"; $("#overallBestMeta").textContent="Finish a quiz to set your first record."; }
  $("#historyList").innerHTML=history.length?history.slice(0,8).map(item=>{ const date=new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"}).format(new Date(item.date)); return `<div class="history-row"><span class="history-mode">${escapeHtml(item.mode)}</span><span>${item.score} correct · ${formatTime(item.seconds)}</span><span class="history-score">${item.accuracy}%</span><span class="history-date">${date}</span></div>`; }).join(""):`<div class="empty-state">Your completed games will appear here with their score and date.</div>`;
  updateStreak();
}
function showToast(message,success){ const toast=$("#resultToast"); toast.textContent=message; toast.classList.remove("hidden","error"); if(!success)toast.classList.add("error"); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>toast.classList.add("hidden"),1500); }

let projection,pathGenerator,mapLayer,labelLayer;
async function drawMap(){
  const svg=d3.select("#map"); projection=d3.geoMercator();
  try {
    const response=await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"); if(!response.ok)throw new Error("Map data unavailable");
    const world=await response.json(),features=topojson.feature(world,world.objects.countries).features;
    const quizFeatures=features.filter(feature=>countryById(feature.id));
    const markerFeatures=COUNTRIES.filter(country=>country.marker).map(country=>({type:"Feature",geometry:{type:"Point",coordinates:country.marker}}));
    projection.fitExtent([[12,6],[888,654]],{type:"FeatureCollection",features:[...quizFeatures,...markerFeatures]}); pathGenerator=d3.geoPath(projection);
    svg.append("path").datum(d3.geoGraticule().step([10,10])()).attr("class","ocean-lines").attr("d",pathGenerator); mapLayer=svg.append("g"); labelLayer=svg.append("g").attr("class","labels");
    const visible=features.filter(feature=>{ const [x,y]=pathGenerator.centroid(feature); return x>-100&&x<1000&&y>-100&&y<680; });
    mapLayer.selectAll("path").data(visible).join("path").attr("d",pathGenerator).attr("class",feature=>countryById(feature.id)?"quiz-country":"outside-country").attr("data-id",feature=>Number(feature.id))
      .on("click",(event,feature)=>{ const c=countryById(feature.id); if(c)handleCountryClick(c); }).on("mousemove",(event,feature)=>{ const c=countryById(feature.id); if(c)showMapTooltip(event,c); }).on("mouseleave",hideMapTooltip);
    COUNTRIES.filter(c=>c.marker).forEach(addMarker); state.mapReady=true; $("#mapLoading").classList.add("hidden");
  } catch { $("#mapLoading").innerHTML=`<strong>Map data couldn't load</strong><small>Please check your connection and refresh.</small>`; }
}
function countryById(id){ return COUNTRIES.find(c=>c.id===Number(id)); }
function addMarker(country){ const [x,y]=projection(country.marker); mapLayer.append("circle").attr("class","quiz-marker").attr("data-id",country.id).attr("cx",x).attr("cy",y).attr("r",country.name==="Maldives"?7:6).on("click",()=>handleCountryClick(country)).on("mousemove",event=>showMapTooltip(event,country)).on("mouseleave",hideMapTooltip); }
function showMapTooltip(event,country){ if(state.active&&state.mode!=="learn")return; const wrap=$("#mapWrap").getBoundingClientRect(),tip=$("#mapTooltip"); tip.innerHTML=`<b>${country.name}</b><span>${country.capital}</span>`; tip.style.left=`${event.clientX-wrap.left+12}px`; tip.style.top=`${event.clientY-wrap.top+10}px`; tip.classList.remove("hidden"); }
function hideMapTooltip(){ $("#mapTooltip").classList.add("hidden"); }
function getCountryNodes(country){ return [...document.querySelectorAll(`[data-id="${country.id}"]`)]; }
function highlightCountry(country,className){ getCountryNodes(country).forEach(node=>node.classList.add(className)); }
function clearHighlights(){ $$(".target,.wrong").forEach(node=>node.classList.remove("target","wrong")); labelLayer?.selectAll("*").remove(); }
function resetMapClasses(){ $$(".quiz-country,.quiz-marker").forEach(node=>node.classList.remove("target","wrong","correct")); labelLayer?.selectAll("*").remove(); }
function addLabel(country){
  if(!labelLayer||labelLayer.select(`[data-label-id="${country.id}"]`).size())return; let point=country.marker?projection(country.marker):null; const path=document.querySelector(`path[data-id="${country.id}"]`);
  if(!point&&path){ const feature=d3.select(path).datum(); point=pathGenerator.centroid(feature); } if(!point||!Number.isFinite(point[0]))return;
  labelLayer.append("text").attr("class",`country-label ${country.name.length>10?"small":""}`).attr("data-label-id",country.id).attr("x",point[0]).attr("y",point[1]).text(country.name);
}
function clearHistory(){ if(!confirm("Reset all saved scores, dates, and streak progress on this device?"))return; localStorage.removeItem("monsoon-atlas-history"); renderProgress(); updateBest(); }
function bindEvents(){
  $$(".mode[data-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.mode)));
  $("#moreMode").addEventListener("click",()=>{ const menu=$("#moreMenu"),open=menu.classList.toggle("hidden")===false; $("#moreMode").setAttribute("aria-expanded",String(open)); });
  $$("[data-extra-mode]").forEach(button=>button.addEventListener("click",()=>setMode(button.dataset.extraMode)));
  $("#startButton").addEventListener("click",startGame); $("#skipButton").addEventListener("click",skipQuestion); $("#typeForm").addEventListener("submit",checkTypedAnswer); $("#clearHistory").addEventListener("click",clearHistory);
  $("#playAgainButton").addEventListener("click",startGame); $("#viewProgressButton").addEventListener("click",()=>{ $("#endScreen").classList.add("hidden"); $(".game-shell").classList.remove("is-playing"); $("#progress").scrollIntoView(); });
  $("#soundToggle").addEventListener("click",event=>{ state.sound=!state.sound; event.currentTarget.textContent=state.sound?"♪":"×"; event.currentTarget.title=state.sound?"Sound on":"Sound off"; event.currentTarget.setAttribute("aria-label",state.sound?"Turn sound off":"Turn sound on"); });
  $("#soundToggleGame").addEventListener("click",()=>$("#soundToggle").click());
  $("#toolbarLearn").addEventListener("click",()=>{ setMode("learn"); startGame(); });
  $$('[data-scroll]').forEach(button=>button.addEventListener("click",()=>document.getElementById(button.dataset.scroll).scrollIntoView()));
}
setupConsent(); setupCountryList(); bindEvents(); renderProgress(); setMode("pin"); drawMap();
