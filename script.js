
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

/* Guest invitations are loaded from the Alphalist sheet through Apps Script.
   No invitation codes or companion names are shipped in public JS. */
let GUESTS = [];
/* ========================================================= */
const $ = s => document.querySelector(s);
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
const keyOf = g => String(g.groupId || g.guestId || "");
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

/* ---------- Google Apps Script backend ---------- */
async function apiPost(payload){
  const r=await fetch(CONFIG.rsvpEndpoint,{
    method:"POST",
    headers:{"Content-Type":"text/plain;charset=utf-8"},
    body:JSON.stringify(payload)
  });
  const data=await r.json();
  if(!data.ok) throw new Error(data.error || "Unable to complete the request.");
  return data;
}
async function loadSheetGuests(){
  const results=$("#results"), panel=$("#panel");
  try{
    const r=await fetch(CONFIG.rsvpEndpoint+"?action=guests",{cache:"no-store"});
    const data=await r.json();
    if(!data.ok || !Array.isArray(data.guests)) throw new Error("Cannot load guest list.");
    GUESTS=data.guests;
  }catch(e){
    panel.innerHTML='<p class="msg err">Guest list is temporarily unavailable. Please try refreshing the page.</p>';
  }
}
loadSheetGuests();
async function saveReply(rec){
  return apiPost({action:"rsvp",...rec});
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
  panel.innerHTML=`
    <div class="card">
      <p class="who">${esc(g.name)}</p>
      <p class="hint">Enter the invitation code sent with your wedding invitation.</p>
      <div class="field">
        <label for="inviteCode">Invitation Code <span aria-label="required">*</span></label>
        <input id="inviteCode" type="text" required maxlength="40" autocomplete="off"
          placeholder="Your invitation code" style="text-transform:uppercase">
      </div>
      <button class="primary" id="verifyInvite" type="button">Continue to RSVP</button>
      <p class="msg" id="verifyMsg" role="status"></p>
    </div>`;
  $("#verifyInvite").addEventListener("click",async()=>{
    const code=$("#inviteCode").value.trim().toUpperCase().replace(/[\s-]/g,"");
    if(!code){$("#inviteCode").reportValidity();return;}
    const btn=$("#verifyInvite"), msg=$("#verifyMsg");
    btn.disabled=true;btn.textContent="Verifying…";msg.textContent="";
    try{
      const data=await apiPost({action:"verify",guestId:g.guestId,groupId:g.groupId,code});
      renderRSVP(data.group,code);
    }catch(e){
      msg.className="msg err";msg.textContent=e.message;
      btn.disabled=false;btn.textContent="Continue to RSVP";
    }
  });
  panel.querySelector(".card").scrollIntoView({behavior:"smooth",block:"start"});
}

function renderRSVP(group,code){
  const members=group.members||[];
  const primary=members.find(m=>m.main)||members[0];
  const saved=group.previous||{};
  const selected=new Set(saved.attendeeIds||[]);
  const hasPrevious=!!group.previous;
  const rows=members.map(m=>`
    <label class="attendee-option">
      <input type="checkbox" class="attendee-check" value="${esc(m.guestId)}"
        ${hasPrevious ? (selected.has(String(m.guestId))?"checked":"") : (m.main?"checked":"")}>
      <span class="attendee-name">${esc(m.name)}
        <small>${m.main?"Main guest":"Companion"}</small></span>
    </label>`).join("");
  panel.innerHTML=`
    <div class="card">
      <p class="who">${esc(primary.name)}</p>
      <div class="seats"><b>${members.length}</b> reserved ${members.length===1?"seat":"seats"}</div>
      <p class="hint">Please select everyone who will attend. Unchecked guests will be marked as not attending.</p>
      <div class="attendee-list">${rows}</div>
      <p class="attendee-counter" id="attendeeCounter" aria-live="polite"></p>
      <div class="field">
        <label for="mobileNo">Mobile No <span aria-label="required">*</span></label>
        <input id="mobileNo" type="tel" inputmode="tel" autocomplete="tel" required
          placeholder="09XXXXXXXXX" maxlength="11" pattern="09[0-9]{9}"
          value="${esc(saved.mobileNo||"")}">
      </div>
      <div class="field"><label for="note">Message for the couple <span class="muted">(optional)</span></label>
        <textarea id="note" maxlength="500">${esc(saved.message||"")}</textarea></div>
      <button class="primary" id="send" type="button">Save our RSVP</button>
      <p class="msg" id="sendMsg" role="status"></p>
    </div>`;
  const updateCount=()=>{
    const n=panel.querySelectorAll(".attendee-check:checked").length;
    $("#attendeeCounter").textContent=`${n} of ${members.length} attending`;
  };
  panel.querySelectorAll(".attendee-check").forEach(x=>x.addEventListener("change",updateCount));
  updateCount();
  $("#send").addEventListener("click",()=>sendGroup(group,code));
  panel.querySelector(".card").scrollIntoView({behavior:"smooth",block:"start"});
}
async function sendGroup(group,code){
  const mobileInput=$("#mobileNo");
  const mobileNo=mobileInput.value.trim();
  if(!/^09\d{9}$/.test(mobileNo)){
    mobileInput.setCustomValidity("Enter an 11-digit mobile number starting with 09.");
    mobileInput.reportValidity();
    mobileInput.addEventListener("input",()=>mobileInput.setCustomValidity(""),{once:true});
    return;
  }
  mobileInput.setCustomValidity("");
  const attendeeIds=[...panel.querySelectorAll(".attendee-check:checked")].map(x=>x.value);
  const btn=$("#send"),msg=$("#sendMsg");
  btn.disabled=true;btn.textContent="Saving…";msg.textContent="";
  try{
    const message=$("#note").value.trim().slice(0,500);
    const result=await saveReply({
      groupId:group.groupId,code,attendeeIds,mobileNo,message
    });
    const rec={
      name:group.members.find(m=>m.main)?.name||group.members[0].name,
      firstName:group.mainFirstName || (group.members.find(m=>m.main)?.name||group.members[0].name).split(" ")[0],
      role:group.weddingRole || "Guest",
      attending:attendeeIds.length>0,seatsUsed:attendeeIds.length,
      seatsReserved:group.members.length,
      companions:group.members.filter(m=>!m.main&&attendeeIds.includes(String(m.guestId))).map(m=>m.name)
    };
    panel.innerHTML=`<div class="card done">
      <p class="big">RSVP saved</p>
      <p>${attendeeIds.length} of ${group.members.length} reserved seats confirmed.</p>
      <p class="hint">You can update your reply later using the same invitation code.</p>
      <button class="ghost" id="again" type="button">Change our reply</button>
    </div>`;
    if(attendeeIds.length) openGuide(rec);
    $("#again").addEventListener("click",()=>renderRSVP({...group,previous:result.previous||{attendeeIds,mobileNo,message}},code));
  }catch(e){
    btn.disabled=false;btn.textContent="Save our RSVP";
    msg.className="msg err";msg.textContent=e.message||"Unable to save RSVP.";
  }
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

/* =========================================================
   DRESS CODE & TIMELINE PAGE
   Edit TIMELINE below once the final program is ready.
   ========================================================= */
const TIMELINE = [
  { time:"4:00 PM",  event:"Wedding ceremony", icon:"rings" },
  { time:"5:00 PM",  event:"Cocktail hour",    icon:"cocktail" },
  { time:"6:00 PM",  event:"Welcome toast",    icon:"toast" },
  { time:"6:30 PM",  event:"Buffet dinner",    icon:"cloche" },
  { time:"7:30 PM",  event:"Cake cutting",     icon:"cake" },
  { time:"8:00 PM",  event:"First dance",      icon:"music" },
  { time:"10:00 PM", event:"Fireworks",        icon:"fireworks" }
];

function roleGroup(role){
  const r=String(role||"").toLowerCase();
  if(/principal|ninang|ninong|parent/.test(r)) return "sponsor";
  if(/best man|maid|matron|groomsm|bridesm|bearer|flower|candle|cord|veil|secondary|entourage/.test(r)) return "entourage";
  return "guest";
}

/* ---------- vector attire figures ---------- */
function shade(hex,f){ const n=parseInt(hex.slice(1),16); let r=n>>16,g=n>>8&255,b=n&255;
  const m=v=>Math.max(0,Math.min(255,Math.round(f<1?v*f:v+(255-v)*(f-1))));
  return "#"+[m(r),m(g),m(b)].map(v=>v.toString(16).padStart(2,"0")).join(""); }
const SKIN="#e6bf9c", HAIR="#3a2618";
function head(y,bun){ return `<ellipse cx="60" cy="${y+4}" rx="14" ry="16" fill="${HAIR}"/>`+
  `<circle cx="60" cy="${y}" r="11.5" fill="${SKIN}"/>`+
  `<path d="M48.5 ${y} Q48 ${y-14} 60 ${y-14} Q72 ${y-14} 71.5 ${y} Q66 ${y-8} 60 ${y-8} Q54 ${y-8} 48.5 ${y}Z" fill="${HAIR}"/>`+
  (bun?`<circle cx="60" cy="${y-15}" r="6" fill="${HAIR}"/>`:""); }
function dots(c,n,x0,x1,y0,y1,seed){ let s=seed||7,o=""; const rnd=()=>(s=(s*9301+49297)%233280)/233280;
  for(let i=0;i<n;i++){ const y=y0+rnd()*(y1-y0), t=(y-y0)/(y1-y0), half=(x1-x0)/2*(.35+.65*t), cx=(x0+x1)/2;
    const x=cx-half+rnd()*half*2; o+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1+rnd()*1.4).toFixed(1)}" fill="${c}" opacity=".75"/>`; }
  return o; }
function woman(o){
  const c=o.c, d=shade(c,.78), l=shade(c,1.25); let s=`<svg viewBox="0 0 120 300" class="fig" aria-hidden="true">`;
  s+=`<path d="M45 64 C38 82 36 102 38 130M75 64 C82 82 84 102 82 130" stroke="${SKIN}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  s+=head(30,true)+`<path d="M55.5 40h9v16h-9z" fill="${SKIN}"/>`;
  s+=`<path d="M44 60 Q60 54 76 60 L74 72 L46 72Z" fill="${SKIN}"/>`;
  const skirt=o.terno?`M49 106 Q60 110 71 106 Q80 180 94 288 Q60 296 26 288 Q40 180 49 106Z`:`M49 106 Q60 110 71 106 Q86 180 102 288 Q60 297 18 288 Q34 180 49 106Z`;
  s+=`<path d="${skirt}" fill="${c}"/>`;
  s+=`<path d="M55 112 Q49 200 38 290M60 112 L60 294M65 112 Q71 200 82 290" stroke="${d}" stroke-width="1.2" fill="none" opacity=".55"/>`;
  if(o.slit) s+=`<path d="M73 190 Q77 240 80 290 L72 291 Q71 240 73 190Z" fill="${SKIN}"/><path d="M73 190 Q79 240 84 290" stroke="${d}" stroke-width="1.3" fill="none"/>`;
  if(o.pat) s+=dots(l,o.terno?46:34,30,90,116,286,o.seed);
  const bod={ one:"M46 70 L74 58 L71 108 Q60 112 49 108Z", off:"M44 64 Q60 60 76 64 L71 108 Q60 112 49 108Z",
    sweet:"M47 68 Q53 61 60 67 Q67 61 73 68 L71 108 Q60 112 49 108Z", halter:"M47 66 L60 58 L73 66 L71 108 Q60 112 49 108Z",
    terno:"M46 60 Q60 66 74 60 L71 108 Q60 112 49 108Z" }[o.neck||"sweet"];
  s+=`<path d="${bod}" fill="${c}"/><path d="M49 107 Q60 111 71 107" stroke="${l}" stroke-width="2" fill="none"/>`;
  if(o.neck==="one") s+=`<path d="M74 58 L72 50" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`;
  if(o.neck==="sweet") s+=`<path d="M48 67 L50 56M72 67 L70 56" stroke="${c}" stroke-width="1.6"/>`;
  if(o.neck==="halter") s+=`<path d="M60 58 L56 44M60 58 L64 44" stroke="${c}" stroke-width="2.4"/>`;
  if(o.neck==="off") s+=`<path d="M44 64 Q36 66 37 76 Q42 72 47 72Z M76 64 Q84 66 83 76 Q78 72 73 72Z" fill="${c}"/>`;
  if(o.flutter) s+=`<path d="M46 66 Q34 64 35 80 Q41 74 48 76Z M74 66 Q86 64 85 80 Q79 74 72 76Z" fill="${l}" opacity=".9"/>`;
  if(o.terno){ s+=`<path d="M47 60 Q30 44 33 70 Q40 66 48 72Z M73 60 Q90 44 87 70 Q80 66 72 72Z" fill="${l}" stroke="${d}" stroke-width=".8"/>`;
    if(o.pat) s+=dots(d,10,50,70,66,104,o.seed+3); }
  if(o.bouquet) s+=`<g><circle cx="56" cy="128" r="9" fill="#efe6f6"/><circle cx="63" cy="124" r="7" fill="#c9b2e2"/><circle cx="52" cy="122" r="6" fill="#f6eee6"/><path d="M58 136 L56 156M60 136 L62 154" stroke="#cdb6e0" stroke-width="1.6"/></g>`;
  return s+"</svg>"; }
function man(o){
  const shoe="#5a3420"; let s=`<svg viewBox="0 0 120 300" class="fig" aria-hidden="true">`;
  s+=`<path d="M44 148 L76 148 L74 282 L62 282 L60 172 L58 282 L46 282Z" fill="${o.pants}"/><path d="M52 160 L52 280M68 160 L68 280" stroke="${shade(o.pants,.75)}" stroke-width="1" opacity=".6"/>`;
  s+=`<path d="M45 280 h14 q2 7 -3 8 h-14 q-3 -4 3 -8Z M61 280 h14 q6 4 3 8 h-14 q-5 -1 -3 -8Z" fill="${shoe}"/>`;
  s+=head(28,false)+`<path d="M55.5 38h9v14h-9z" fill="${SKIN}"/>`;
  if(o.type==="barong"){ const c="#f3ead8", e="#cbb48a";
    s+=`<path d="M42 58 L33 150 L41 152 L49 80Z M78 58 L87 150 L79 152 L71 80Z" fill="${c}" stroke="${e}" stroke-width=".6"/>`;
    s+=`<circle cx="37" cy="155" r="4" fill="${SKIN}"/><circle cx="83" cy="155" r="4" fill="${SKIN}"/>`;
    s+=`<path d="M42 56 Q60 50 78 56 L82 170 L38 170Z" fill="${c}" stroke="${e}" stroke-width=".6"/>`;
    s+=`<path d="M54 54 L60 64 L66 54" fill="none" stroke="${e}" stroke-width="1.2"/><path d="M53 64 L53 168M67 64 L67 168" stroke="${e}" stroke-width=".8"/>`;
    for(let y=72;y<164;y+=9) s+=`<path d="M55 ${y} q5 -4 10 0 M55 ${y+4} q5 4 10 0" stroke="${e}" stroke-width=".8" fill="none"/>`;
    s+=`<path d="M60 64 L60 168" stroke="${e}" stroke-width=".6" stroke-dasharray="2 3"/>`; }
  else if(o.type==="suit"){ const c=o.coat, d=shade(c,.8);
    s+=`<path d="M42 58 L33 152 L41 154 L49 80Z M78 58 L87 152 L79 154 L71 80Z" fill="${c}" stroke="${d}" stroke-width=".6"/>`;
    s+=`<circle cx="37" cy="157" r="4" fill="${SKIN}"/><circle cx="83" cy="157" r="4" fill="${SKIN}"/>`;
    s+=`<path d="M42 56 Q60 50 78 56 L80 158 L40 158Z" fill="${c}"/><path d="M53 54 L60 100 L67 54Z" fill="#fbf8f2"/>`;
    s+=`<path d="M58.5 60 L61.5 60 L62.5 92 L60 97 L57.5 92Z" fill="${o.tie}"/>`;
    s+=`<path d="M53 54 L49 70 L58 96 M67 54 L71 70 L62 96" fill="none" stroke="${d}" stroke-width="1.4"/><path d="M60 100 L60 158" stroke="${d}" stroke-width=".8"/>`;
    s+=`<circle cx="62" cy="112" r="1.4" fill="${d}"/><circle cx="62" cy="126" r="1.4" fill="${d}"/><path d="M68 76 h7 l-1 4 h-5Z" fill="#d9c7e8"/>`; }
  else { const v=o.vest, d=shade(v,.7);
    s+=`<path d="M42 58 L34 150 L42 152 L49 80Z M78 58 L86 150 L78 152 L71 80Z" fill="#fbfbfb" stroke="#d6d6d6" stroke-width=".6"/>`;
    s+=`<circle cx="38" cy="155" r="4" fill="${SKIN}"/><circle cx="82" cy="155" r="4" fill="${SKIN}"/>`;
    s+=`<path d="M43 56 Q60 50 77 56 L78 150 L42 150Z" fill="#fbfbfb"/><path d="M54 54 L60 62 L66 54" fill="none" stroke="#d0d0d0" stroke-width="1"/>`;
    s+=`<path d="M58.5 62 L61.5 62 L62.5 92 L60 96 L57.5 92Z" fill="${o.tie||d}"/>`;
    s+=`<path d="M46 64 L54 62 L60 104 L66 62 L74 64 L77 150 L43 150Z" fill="${v}"/>`;
    for(let y=110;y<146;y+=10) s+=`<circle cx="61" cy="${y}" r="1.3" fill="${shade(v,1.5)}"/>`;
    s+=`<path d="M70 70 h5 l-.5 3 h-4Z" fill="#efe6f6"/>`; }
  return s+"</svg>"; }

/* ---------- attire by role ---------- */
const DRESS = {
  guest:{ title:"Guest", intro:"Come dressed in soft shades of lilac and lavender to match the evening of lanterns.",
    groups:[ { label:"Women", note:"Shades of lilac, long gowns", palette:["#6e4c8f","#9d80bd","#c3aee0","#dccdee","#dcc4dc","#c09bbd"],
        figs:[woman({c:"#b89ad6",neck:"one"}),woman({c:"#a98bc9",neck:"off"}),woman({c:"#c3a8df",neck:"sweet",flutter:1}),woman({c:"#b394d3",neck:"halter",slit:1}),woman({c:"#bda2d9",neck:"sweet",pat:1,seed:11})] },
      { label:"Men", note:"Barong Tagalog", palette:["#f6efe1","#ece0c8","#dccbac","#bfa985","#3b3539","#26222a"],
        figs:[man({type:"barong",pants:"#2e2a2e"}),man({type:"barong",pants:"#3a3438"}),man({type:"barong",pants:"#d8c8ad"})] } ] },
  sponsor:{ title:"Principal Sponsor", intro:"As our principal sponsors, you'll be dressed in timeless cream and champagne.",
    groups:[ { label:"Ninang", note:"Modern Filipiniana in cream, any design", palette:["#f3ebe0","#ecdfcb","#e9d8bd","#dcc08c","#d2b47e","#c9a76e"],
        figs:[woman({c:"#eadcc3",neck:"terno",terno:1,pat:1,seed:3}),woman({c:"#e6d5b8",neck:"terno",terno:1,pat:1,seed:9}),woman({c:"#efe3cd",neck:"terno",terno:1,pat:1,seed:17}),woman({c:"#e3cfb0",neck:"terno",terno:1,pat:1,seed:23})] },
      { label:"Ninong", note:"Cream coat and tie", palette:["#efe5d4","#e6d8c0","#d9c6a6","#c9b28a","#a6865a","#6a4a2c"],
        figs:[man({type:"suit",coat:"#e8dcc6",tie:"#c9b28a",pants:"#e2d5bd"}),man({type:"suit",coat:"#eadfcb",tie:"#b89ad6",pants:"#e4d8c2"}),man({type:"suit",coat:"#e4d6bd",tie:"#a6865a",pants:"#ddcfb5"})] } ] },
  entourage:{ title:"Entourage", intro:"You'll stand beside us in dusty mauve and navy, so the photos look as lovely as you are.",
    groups:[ { label:"Ladies", note:"Dusty mauve long gowns, each in your own cut", palette:["#6f4b66","#7e5a74","#9a7a8e","#a88496","#b8a0ad","#dcc9d1"],
        figs:[woman({c:"#7e5a74",neck:"one",bouquet:1}),woman({c:"#a88496",neck:"off",bouquet:1}),woman({c:"#b0909f",neck:"sweet",bouquet:1}),woman({c:"#9f7f92",neck:"halter",slit:1,bouquet:1})] },
      { label:"Gentlemen", note:"Navy vest and trousers, white long-sleeved shirt, brown shoes", palette:["#1f2c50","#26365f","#3a4a75","#f7f5f0","#e9e4da","#6a4026"],
        figs:[man({type:"suit",coat:"#24345e",tie:"#24345e",pants:"#24345e"}),man({type:"vest",vest:"#26365f",pants:"#26365f"}),man({type:"vest",vest:"#26365f",pants:"#26365f"})] } ],
    note:"Bearers and flower girls follow the same mauve, navy and white palette." }
};

/* ---------- timeline icons ---------- */
const ICON = {
  rings:`<circle cx="18" cy="30" r="9"/><circle cx="30" cy="30" r="9"/><path d="M14 18l4-5h8l4 5-8 4z"/>`,
  toast:`<path d="M10 8h10l-1 10a4 4 0 0 1-8 0zM15 22v14M10 36h10M28 8h10l-1 10a4 4 0 0 1-8 0zM33 22v14M28 36h10"/>`,
  cocktail:`<path d="M10 10h28L24 26zM24 26v12M17 38h14M30 6l4 6"/><circle cx="35" cy="5" r="2"/>`,
  cloche:`<path d="M8 32h32M10 32a14 14 0 0 1 28 0M24 16v-3M21 13h6M6 36h36"/>`,
  cake:`<path d="M10 38h28V28H10zM13 28V20h22v8M17 20v-6h14v6M24 14v-4"/><path d="M10 33q3.5 3 7 0t7 0 7 0 7 0"/>`,
  music:`<path d="M18 34V12l16-4v22"/><circle cx="14" cy="34" r="4"/><circle cx="30" cy="30" r="4"/>`,
  fireworks:`<path d="M24 24v18M24 24l-8-8M24 24l8-8M24 24h-10M24 24h10M24 24l-6 8M24 24l6 8M24 24V12"/><path d="M38 8v6M35 11h6M10 6v4M8 8h4"/>`
};
const svgIcon=n=>`<svg viewBox="0 0 48 48" class="ti-ic" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[n]||ICON.rings}</svg>`;

function openGuide(rec){
  const grp=roleGroup(rec.role), D=DRESS[grp];
  // Personalize only for the main guest, never concatenate companions.
  const rawFirstName=String(rec.firstName||rec.name||"Guest").trim().split(/\s+/)[0];
  const who=rawFirstName.toLocaleLowerCase("en-PH").replace(/^./,c=>c.toLocaleUpperCase("en-PH"));
  $("#gHello").textContent=`Dear ${who},`;
  $("#gRole").textContent=D.title;
  $("#gIntro").textContent=D.intro;
  $("#gAttire").innerHTML=D.groups.map(g=>`
    <div class="att-group">
      <p class="caps">${g.label}</p>
      <p class="att-note">${g.note}</p>
      <div class="figs">${g.figs.join("")}</div>
      <div class="pal-wrap"><p class="pal-label">${g.label} palette</p><div class="pal">${g.palette.map(c=>`<span style="background:${c}"></span>`).join("")}</div></div>
    </div>`).join("")+(D.note?`<p class="att-extra">${D.note}</p>`:"");
  $("#gTimeline").innerHTML=TIMELINE.map((t,i)=>`
    <li class="${i%2?"l":"r"}"><span class="ti-dot"></span>${svgIcon(t.icon)}<div class="ti-txt"><b>${esc(t.time)}</b><span>${esc(t.event)}</span></div></li>`).join("");
  const g=$("#guide"); g.hidden=false; g.scrollTop=0; document.body.style.overflow="hidden";
  requestAnimationFrame(()=>g.classList.add("on")); $("#gBack").focus();
}
function closeGuide(){ const g=$("#guide"); g.classList.remove("on"); document.body.style.overflow=""; setTimeout(()=>g.hidden=true,400); }
$("#gBack").addEventListener("click",closeGuide);
$("#gBack2").addEventListener("click",closeGuide);
addEventListener("keydown",e=>{ if(e.key==="Escape" && !$("#guide").hidden && $("#lb").hidden) closeGuide(); });

