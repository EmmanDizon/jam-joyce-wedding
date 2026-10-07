
/* =========================================================
   SETTINGS — edit these
   ========================================================= */
const CONFIG = {
  // Paste your Google Apps Script web app URL here once the page is hosted
  // (Netlify / GitHub Pages). Leave "" when viewing on claude.ai.
  rsvpEndpoint: "https://script.google.com/macros/s/AKfycbwld34Ltj0jZZbOc1a7_AoWgFx46XRiZPvAeUCnoiJ6EgqzO87aXe4LyicgrVeWYKiY/exec",
  // Optional reply deadline shown above the search box, e.g. "January 27, 2027"
  replyBy: "",
  weddingStart: "2027-02-27T16:00:00+08:00"
};

/* Guest list: name, seats reserved, and how they're listed.
   If rsvpEndpoint is set, the list is loaded from your Google Sheet instead. */
let GUESTS = [
  ["Mr. & Mrs. Albert Mangaliag",2,"Parents of the groom"],
  ["Mr. & Mrs. Heriberto Dizon",2,"Parents of the bride"],
  ["Reymel Gomez",2,"Principal sponsor"],["Robert Peñaflor",2,"Principal sponsor"],["Reynaldo Gomez Jr.",2,"Principal sponsor"],
  ["Manuel Dizon Jr.",2,"Principal sponsor"],["Alex Dizon",2,"Principal sponsor"],["Enrique Dizon Jr.",2,"Principal sponsor"],
  ["Edwin Dizon",2,"Principal sponsor"],["Ryan Dizon",2,"Principal sponsor"],["Edwin Mangaliag",2,"Principal sponsor"],
  ["Alvin Mangaliag",2,"Principal sponsor"],["Michael Manauis",2,"Principal sponsor"],["BJ Manauis",2,"Principal sponsor"],
  ["Vangie Arandia",2,"Principal sponsor"],["Eugene Espero",2,"Principal sponsor"],["Jomelyn Lopez",2,"Principal sponsor"],
  ["Elvie Cornejo",2,"Principal sponsor"],["Milry Braun",2,"Principal sponsor"],["Julie Bayonon",2,"Principal sponsor"],
  ["Gilma Fabella",2,"Principal sponsor"],["Abby Mangaliag",2,"Principal sponsor"],["Lorny Leotangco",2,"Principal sponsor"],
  ["Eva Macababad",2,"Principal sponsor"],["Honeylet Yason",2,"Principal sponsor"],["Anne Agustin",2,"Principal sponsor"],
  ["Sean Andre Mangaliag",1,"Best man"],["Noreen Mae Dizon",1,"Maid of honor"],
  ["Edrick Mangaliag",1,"Candle sponsor"],["Princess Mangaliag",1,"Candle sponsor"],
  ["Carl David Quidilla",1,"Cord sponsor"],["Kim Karunungan",1,"Cord sponsor"],["Howard Tiangco",1,"Cord sponsor"],["Rica Vinco",1,"Cord sponsor"],
  ["Jefferson Lui",1,"Veil sponsor"],["Kara Izabela dela Cruz",1,"Veil sponsor"],["John Mathew Cruz",1,"Veil sponsor"],["Camille delos Santos",1,"Veil sponsor"],
  ["Von Albert Mangaliag",1,"Groomsman"],["Richard Dizon",1,"Groomsman"],["Richard Henrick Dizon",1,"Groomsman"],["Ethan Aldous Mangaliag",1,"Groomsman"],
  ["Lanmel Galicia",1,"Bridesmaid"],["Rafaela Gomez",1,"Bridesmaid"],["Alpha Mangaliag",1,"Bridesmaid"],["Hanna Sophia Wala-Wala",1,"Bridesmaid"],
  ["Reymel John Galicia",1,"Bible bearer"],["Reynaldo Gomez III",1,"Coin bearer"],["Jude O'Connor",1,"Ring bearer"],
  ["Sophia Angel Galicia",1,"Flower girl"],["Dani Manauis",1,"Flower girl"],["Sarah Milan Peñaflor",1,"Flower girl"],
  ["Mia O'Connor",1,"Flower girl"],["Alex Dizon",1,"Flower girl"]
].map(([name,seats,role])=>({name,seats,role}));

/* ========================================================= */
const $ = s => document.querySelector(s);
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
const keyOf = g => norm(g.name + " " + (g.role||"")).replace(/\s/g,"-").slice(0,180) || "guest";
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ---------- Opening moment ---------- */
$("#openBtn").addEventListener("click",()=>{ $("#gate").classList.add("gone"); setTimeout(()=>$("#gate").remove(),1200); });

/* ---------- Lanterns ---------- */
(function(){
  const box=$("#lanterns"), reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const n = innerWidth<600 ? 16 : 28;
  for(let i=0;i<n;i++){
    const l=document.createElement("span"); l.className="lantern";
    const depth=Math.random();
    const w=8+depth*26;
    l.style.cssText=`left:${Math.random()*96}%;--w:${w.toFixed(1)}px;--d:${(26-depth*12).toFixed(1)}s;--delay:${(-Math.random()*24).toFixed(1)}s;--sway:${(Math.random()*50-25).toFixed(0)}px;--o:${(.45+depth*.55).toFixed(2)};--top:${(10+Math.random()*70).toFixed(0)}%;filter:blur(${((1-depth)*1.4).toFixed(1)}px)`;
    if(reduce) l.style.opacity=(.45+depth*.5).toFixed(2);
    box.appendChild(l);
  }
})();

/* ---------- Countdown ---------- */
(function(){
  const t=new Date(CONFIG.weddingStart).getTime();
  function tick(){
    let s=Math.max(0,Math.floor((t-Date.now())/1000));
    $("#cd-d").textContent=Math.floor(s/86400);
    $("#cd-h").textContent=Math.floor(s%86400/3600);
    $("#cd-m").textContent=Math.floor(s%3600/60);
  }
  tick(); setInterval(tick,30000);
})();
if(CONFIG.replyBy){ const r=$("#replyBy"); r.textContent="Kindly reply by "+CONFIG.replyBy+"."; r.hidden=false; }

/* ---------- Storage backends ---------- */
let db=null, dbWritable=true;
async function loadSheetGuests(){
  if(!CONFIG.rsvpEndpoint) return;
  try{
    const r=await fetch(CONFIG.rsvpEndpoint);
    const j=await r.json();
    if(Array.isArray(j.guests)&&j.guests.length) GUESTS=j.guests.map(g=>({name:String(g.name),seats:Number(g.seats)||1,role:String(g.role||"")}));
  }catch(e){ /* keep built-in list */ }
}
loadSheetGuests();

async function saveReply(rec){
  if(CONFIG.rsvpEndpoint){
    const r=await fetch(CONFIG.rsvpEndpoint,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(rec)});
    const j=await r.json().catch(()=>({ok:r.ok}));
    if(!j.ok) throw new Error("sheet");
    return "sheet";
  }
  if(db && dbWritable){
    try{ await db.collection("rsvps").doc(rec.key).set(rec); return "db"; }
    catch(e){ if(e&&e.code==="invalid_argument") dbWritable=false; throw e; }
  }
  throw new Error("none");
}

/* ---------- Search ---------- */
const q=$("#q"), results=$("#results"), panel=$("#panel");
function search(text){
  const t=norm(text); if(t.length<2) return [];
  const parts=t.split(" ");
  return GUESTS.filter(g=>{
    const words=norm(g.name).split(" ");
    return parts.every(p=>words.some(w=>w.startsWith(p)));
  }).slice(0,8);
}
q.addEventListener("input",()=>{
  const list=search(q.value);
  results.innerHTML="";
  if(q.value.trim().length>=2 && !list.length){
    panel.innerHTML=`<p class="msg">We couldn't find that name. Try just your last name, or message Jam or Joyce so they can add you.</p>`;
    return;
  }
  if(panel.querySelector(".msg") && !panel.querySelector(".card")) panel.innerHTML="";
  list.forEach(g=>{
    const li=document.createElement("li"), b=document.createElement("button");
    b.type="button"; b.innerHTML=`${esc(g.name)}<small>${esc(g.role||"Guest")}</small>`;
    b.addEventListener("click",()=>pick(g)); li.appendChild(b); results.appendChild(li);
  });
});

function pick(g){
  results.innerHTML=""; q.value=g.name;
  const extra=Math.max(0,g.seats-1);
  let comp="";
  for(let i=1;i<=extra;i++) comp+=`<div class="field"><label for="c${i}">Companion ${extra>1?i+" ":""}name</label><input type="text" id="c${i}" autocomplete="name" placeholder="Full name"></div>`;
  panel.innerHTML=`
  <div class="card">
    <p class="who">${esc(g.name)}</p>
    <div class="seats"><b>${g.seats}</b>${g.seats===1?"seat is reserved for you":"seats are reserved for you"}</div>
    <div class="choice" role="radiogroup" aria-label="Will you attend?">
      <input type="radio" name="att" id="att-y" value="yes" checked><label for="att-y">Joyfully accepts</label>
      <input type="radio" name="att" id="att-n" value="no"><label for="att-n">Regretfully declines</label>
    </div>
    <div id="comps">${comp}${extra?`<p class="hint" style="margin-top:-.4rem;margin-bottom:1rem">Leave a companion field blank if that seat won't be used.</p>`:""}</div>
    <div class="field"><label for="note">Message for the couple <span class="muted">(optional)</span></label><textarea id="note" maxlength="500"></textarea></div>
    <button class="primary" id="send" type="button">Send my reply</button>
    <p class="msg" id="sendMsg" role="status"></p>
  </div>`;
  panel.querySelectorAll('input[name=att]').forEach(r=>r.addEventListener("change",()=>{
    $("#comps").style.display = $("#att-y").checked ? "" : "none";
  }));
  $("#send").addEventListener("click",()=>send(g));
  panel.querySelector(".card").scrollIntoView({behavior:"smooth",block:"start"});
}

async function send(g){
  const attending=$("#att-y").checked;
  const companions=attending?[...panel.querySelectorAll('#comps input')].map(i=>i.value.trim()).filter(Boolean):[];
  const rec={key:keyOf(g),name:g.name,role:g.role||"",attending,seatsReserved:g.seats,
    seatsUsed:attending?1+companions.length:0,companions,message:($("#note").value||"").trim().slice(0,500),repliedAt:new Date().toISOString()};
  const btn=$("#send"), m=$("#sendMsg");
  btn.disabled=true; btn.textContent="Sending…"; m.className="msg"; m.textContent="";
  try{
    await saveReply(rec);
    try{ localStorage.setItem("jj-reply",JSON.stringify(rec)); }catch(e){}
    showDone(rec);
  }catch(e){
    btn.disabled=false; btn.textContent="Send my reply";
    const summary=`RSVP for Jam & Joyce (Feb 27, 2027)\nName: ${rec.name}\nReply: ${attending?"Attending":"Not attending"}\nSeats: ${rec.seatsUsed} of ${rec.seatsReserved}${companions.length?"\nCompanions: "+companions.join(", "):""}${rec.message?"\nMessage: "+rec.message:""}`;
    m.className="msg err";
    m.innerHTML=`Your reply couldn't be saved here. Copy it and send it to Jam or Joyce instead.<br><button class="ghost" id="copyBtn" type="button">Copy my reply</button>`;
    $("#copyBtn").addEventListener("click",async()=>{
      try{ await navigator.clipboard.writeText(summary); $("#copyBtn").textContent="Copied"; }
      catch(_){ m.insertAdjacentHTML("beforeend",`<textarea readonly style="margin-top:.6rem">${esc(summary)}</textarea>`); }
    });
  }
}

function showDone(rec){
  panel.innerHTML=`<div class="card done">
    <p class="big">${rec.attending?"See you there":"Thank you"}</p>
    <p>${rec.attending
      ? `We've saved ${rec.seatsUsed} ${rec.seatsUsed===1?"seat":"seats"} for ${esc(rec.name)}${rec.companions.length?" with "+esc(rec.companions.join(", ")):""}.`
      : `We'll miss you, ${esc(rec.name)}. Thank you for letting us know.`}</p>
    <button class="ghost" type="button" id="again">Change my reply</button>
  </div>`;
  $("#again").addEventListener("click",()=>{ const g=GUESTS.find(x=>keyOf(x)===rec.key)||{name:rec.name,seats:rec.seatsReserved,role:rec.role}; pick(g); });
}

/* ---------- Scroll effects ---------- */
(function(){
  const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const els=document.querySelectorAll(".reveal,.scroll.rollable:not(.hero-scroll)");
  const scrolls=[...document.querySelectorAll(".scroll.rollable")];
  function measure(){ scrolls.forEach(sc=>{ const h=sc.querySelector(".paper").offsetHeight; sc.style.setProperty("--h",h+"px"); sc.style.setProperty("--dur",Math.min(2.8,Math.max(1.3,h/650)).toFixed(2)+"s"); }); }
  measure(); addEventListener("resize",measure); document.fonts&&document.fonts.ready.then(measure);

  if(reduce||!("IntersectionObserver" in window)){ els.forEach(e=>e.classList.add("in")); return; }
  const io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add("in"); io.unobserve(e.target); } }),{threshold:.12,rootMargin:"0px 0px -6% 0px"});
  els.forEach(e=>io.observe(e));
  const photo=document.querySelector(".sky .photo"), lan=document.querySelector(".sky .lanterns"),
        gar=document.querySelectorAll(".garland"), arch=document.querySelector(".arch"),
        layers=[...document.querySelectorAll(".px-bg[data-speed]")];
  let ticking=false;
  function frame(){
    ticking=false;
    const y=scrollY, vh=innerHeight;
    layers.forEach(l=>{
      const r=l.parentElement.getBoundingClientRect();
      if(r.bottom<-50||r.top>vh+50) return;
      const off=(r.top+r.height/2-vh/2)*-Number(l.dataset.speed);
      l.style.transform=`translate3d(0,${off.toFixed(1)}px,0)`;
    });
  }
  addEventListener("scroll",()=>{ if(!ticking){ ticking=true; requestAnimationFrame(frame); } },{passive:true});
  addEventListener("resize",frame);
  frame();
})();

/* ---------- Photo viewer ---------- */
(function(){
  const shots=[...document.querySelectorAll("img[data-zoom]")], lb=$("#lb"), im=$("#lbImg"); let i=0, last=null;
  function show(n){ i=(n+shots.length)%shots.length; im.src=shots[i].src; im.alt=shots[i].alt; }
  shots.forEach((el,n)=>el.addEventListener("click",()=>{ last=el; show(n); lb.hidden=false; $("#lbX").focus(); }));
  function close(){ lb.hidden=true; last&&last.focus&&last.focus(); }
  $("#lbX").addEventListener("click",close);
  $("#lbP").addEventListener("click",()=>show(i-1)); $("#lbN").addEventListener("click",()=>show(i+1));
  lb.addEventListener("click",e=>{ if(e.target===lb) close(); });
  addEventListener("keydown",e=>{ if(lb.hidden) return; if(e.key==="Escape") close(); if(e.key==="ArrowLeft") show(i-1); if(e.key==="ArrowRight") show(i+1); });
  let x0=null; im.addEventListener("touchstart",e=>x0=e.touches[0].clientX,{passive:true});
  im.addEventListener("touchend",e=>{ if(x0==null) return; const dx=e.changedTouches[0].clientX-x0; if(Math.abs(dx)>40) show(i+(dx<0?1:-1)); x0=null; });
})();

/* ---------- claude.ai runtime (optional) ---------- */
(async function(){
  if(!window.claude || !window.claude.use) return;
  try{
    db = await window.claude.use("db");
    const user = await window.claude.use("user");
    if(user){
      const w = await user.can("data.write");
      if(w===false) dbWritable=false;
      if(db && await user.isOwner()) startHost();
    }
  }catch(e){}
})();

function startHost(){
  $("#host").classList.add("on");
  db.collection("rsvps").onSnapshot(snap=>{
    const rows=snap.docs.map(d=>d.data()).filter(Boolean).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    let yes=0,no=0,seats=0;
    rows.forEach(r=>{ if(r.attending){yes++;seats+=Number(r.seatsUsed)||0}else no++; });
    $("#totals").innerHTML=`<span><b>${yes}</b> attending</span><span><b>${no}</b> declined</span><span><b>${seats}</b> seats confirmed</span>`;
    $("#rows").innerHTML = rows.length ? rows.map(r=>`<tr><td>${esc(r.name)}<br><small class="muted">${esc(r.role||"")}</small></td><td>${r.attending?"Attending":"Declined"}</td><td>${Number(r.seatsUsed)||0} / ${Number(r.seatsReserved)||0}</td><td>${esc((r.companions||[]).join(", "))}</td><td>${esc(r.message||"")}</td></tr>`).join("")
      : `<tr><td colspan="5" class="muted">No replies yet. They'll appear here as guests respond.</td></tr>`;
  },()=>{});
}
