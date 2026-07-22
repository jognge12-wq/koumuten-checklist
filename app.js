/* =========================================================================
   工程チェックリスト — フロントエンド本体
   - CONFIG.GAS_URL が空なら DEMO モード（localStorage で完全動作）
   - 設定するとその GAS Web アプリと同期
   - オフライン前提: fetch は try/catch、失敗時はキャッシュ＋エラー表示
   ========================================================================= */

var CONFIG = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbzWVbk1fSow22U3GooRg5ax6HzJ1f1p6W_oyLPRe0_-NH2AJjSUu7TtiQdR9UTKsif5Lg/exec",  // 本番GAS
  API_TOKEN: "yhg-kc-2026-7a3f",  // GAS 側 TOKEN と一致（公開クライアントなので強固な秘密ではなく軽いゲート）
  VAPID_PUBLIC_KEY: "",    // Web Push 用（Worker と対）
  WORKER_URL: ""           // 通知送信 Worker（購読はここへは送らず GAS 経由）
};
var LIVE = !!CONFIG.GAS_URL;

/* ---- 工程順・担当既定 ---- */
var PHASES = ["着工前","基礎完了","建て方","木完","竣工","引渡し"];
var PHASE_WHO = { "着工前":"大澤","基礎完了":"大澤","建て方":"山川","木完":"山川","竣工":"山川","引渡し":"山川" };

/* ---- 項目マスタ（確定v3・39項目） ---- */
var MASTER = {
  "着工前": [
    "基礎作業計画書の提出",
    "駐車場案内図の伝言板共有",
    "工事看板の掲示があるか",
    "駐車場案内図を工事看板に掲示する",
    "カラーコーン・トラバー・輪留めは片付いているか"
  ],
  "基礎完了": [
    "基礎精算",
    "作業構成メンバー表の更新",
    "木建主任者の氏名テプラ貼り",
    "モルタル現場は中和剤があるか",
    "排水桝場にマットが入っているか",
    "現場ゲートは閉まっているか",
    "日誌の記入"
  ],
  "建て方": [
    "日誌の記入",
    "納品書保管ケースの設置",
    "足場のメッシュシートの未復旧はないか",
    "足場作業床・手摺・筋交いの未復旧はないか",
    "引き込み線のトラロープ養生があるか",
    "開口部の仮床（ネット）があるか",
    "手摺・巾木があるか",
    "玄関ポーチに満水バケツがあるか",
    "建物内各階に消火器があるか",
    "サッシ干渉部の養生があるか",
    "透明ガラスの養生",
    "玄関ドア養生があるか",
    "防蟻剤容器の危険物ラベル貼り",
    "産廃ボックス付近に産廃看板が掲示してあるか",
    "産廃ボックスに雨養生の桟木があるか",
    "夏季：玄関に熱中症のポスターがあるか",
    "夏季：玄関に熱中症対策キットがあるか",
    "夏季：玄関に温湿度計が掲示してあるか"
  ],
  "木完": [
    "床材ラベルの貼り付け",
    "日誌の記入"
  ],
  "竣工": [
    "カウンター上の養生がしてあるか（気泡緩衝材）",
    "玄関床の内外に養生がしてあるか",
    "産廃・残材の引き上げ",
    "日誌の記入"
  ],
  "引渡し": [
    "再クリーニング",
    "手直し完了確認",
    "日誌の記入"
  ]
};

/* ---- 利用者マスタ ---- */
/* 利用者
   - チェックする人は必ず個人名（「誰が・いつ」の証跡が残るため）
   - 見るだけの人はグループでよい（記録が残らない／人の入れ替わりに強い） */
var USERS = [
  { name:"大澤", role:"work", org:"矢橋林業" },
  { name:"山川", role:"work", org:"矢橋林業" },
  { name:"生産グループ", role:"view", org:"住友林業" }
];
/* 物件に割り当てる生産担当（＝物件の属性。絞り込みはここと実データから作る） */
var SEISAN = ["永井","藤井","城岸","河出","市川","桑原","髙橋"];

/* ---- 工程完了コメント（30・絵文字なし） ---- */
var COMPLETE_MSGS = [
  "おつかれさまでした。ひとつ工程がまるっと完了です。","完了ありがとうございます。丁寧な仕事、助かります。",
  "ナイスチェック。この工程、抜かりなしですね。","全項目クリアです。さすがの段取り。",
  "完璧です。気持ちよく次へ進めます。","ひと工程、無事完了。いつもありがとうございます。",
  "おつかれさまです。現場、着実に前進しています。","チェック完了、お見事です。",
  "この工程、フィニッシュ。おつかれさまでした。","抜け漏れゼロ、素晴らしいです。",
  "完了です。安心してバトンを渡せます。","きっちり完了。頼りになります。",
  "全部そろいました。ありがとうございます。","この調子。工程クリアです。",
  "隅々までチェック、さすがです。","完了ありがとうございます。良い家になりそうですね。",
  "おつかれさまでした。今日のゴール達成です。","全部完了、文句なしです。",
  "工程フィニッシュ。いつも助かっています。","丁寧な確認、ありがとうございました。",
  "ひと段落ですね。おつかれさまでした。","完了です。丁寧さが伝わってきます。",
  "きれいに揃いました。ありがとうございます。","バッチリです。次工程もよろしくお願いします。",
  "積み重ねが形になっていますね。おつかれさまでした。","この工程、金メダル級の仕上がりです。",
  "完璧な仕事です。頭が下がります。","現場がまた一歩進みました。おつかれさまでした。",
  "ひと息どうぞ。おつかれさまでした。","やりきりましたね。おつかれさまです。"
];
function pickMsg(seed){ return COMPLETE_MSGS[Math.abs(seed) % COMPLETE_MSGS.length]; }

/* ---- SVG アイコン ---- */
var IC = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11 12 4.5l8.5 6.5"/><path d="M5.5 9.8V19.5h13V9.8"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m8.3 12 2.4 2.4 4.8-5"/></svg>'
};

/* =========================================================================
   状態
   ========================================================================= */
var STATE = { user:null, role:null, properties:[], currentId:null, showDone:false, filterSeisan:"全員" };
var DB_KEY = "kc_db_v1", ME_KEY = "kc_me_v1";

function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function todayMid(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
function fmtShort(d){ return (d.getMonth()+1)+"/"+d.getDate(); }
function fmtAt(at){ // "7/15" はそのまま／SheetsがDate化して返すISO文字列は M/D に整形
  if(!at) return "";
  if(/^\d{1,2}\/\d{1,2}$/.test(at)) return at;
  var d=new Date(at); return isNaN(d) ? String(at) : fmtShort(d);
}
function parseISO(s){ if(!s) return null; var p=s.split("-"); return new Date(+p[0],+p[1]-1,+p[2]); }
function toISO(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function daysBetween(a,b){ return Math.round((a-b)/86400000); }
function keyOf(phase,item){ return phase+"||"+item; }

/* =========================================================================
   デモ用シードデータ
   ========================================================================= */
function buildChecks(phasesWithChecked){
  // phasesWithChecked: { phase: {item: {by,at}} }  未指定は未チェック
  var checks = {};
  PHASES.forEach(function(ph){
    MASTER[ph].forEach(function(it){
      var pre = (phasesWithChecked[ph]||{})[it];
      checks[keyOf(ph,it)] = pre ? { done:true, by:pre.by, at:pre.at } : { done:false };
    });
  });
  return checks;
}
function seed(){
  var Y=2026;
  return [
    { id:"p1", name:"山田様邸", seisan:"永井",
      dates:{ "着工前":Y+"-05-18","基礎完了":Y+"-06-20","建て方":Y+"-07-10","木完":Y+"-07-24","竣工":"","引渡し":"" },
      checks: buildChecks({
        "着工前": Object.fromEntries(MASTER["着工前"].map(function(i){return [i,{by:"大澤",at:"5/15"}];})),
        "基礎完了": Object.fromEntries(MASTER["基礎完了"].map(function(i){return [i,{by:"大澤",at:"6/22"}];})),
        "建て方": { "日誌の記入":{by:"山川",at:"7/10"}, "納品書保管ケースの設置":{by:"山川",at:"7/9"} }
      })
    },
    { id:"p2", name:"佐藤様邸", seisan:"永井",
      dates:{ "着工前":Y+"-06-30","基礎完了":Y+"-07-18","建て方":"","木完":"","竣工":"","引渡し":"" },
      checks: buildChecks({
        "着工前": Object.fromEntries(MASTER["着工前"].slice(0,3).map(function(i){return [i,{by:"大澤",at:"6/28"}];}))
      })
    },
    { id:"p3", name:"鈴木様邸", seisan:"藤井",
      dates:{ "着工前":Y+"-03-10","基礎完了":Y+"-04-05","建て方":Y+"-05-01","木完":Y+"-06-10","竣工":"","引渡し":"" },
      checks: (function(){
        var c = buildChecks({});
        // ほぼ完了（残り数件）
        var n=0; PHASES.forEach(function(ph){ MASTER[ph].forEach(function(it){ n++; if(n>3) c[keyOf(ph,it)]={done:true,by:"山川",at:"—"}; }); });
        return c;
      })()
    }
  ];
}

/* =========================================================================
   永続化 & API（DEMO / LIVE）
   ========================================================================= */
function loadLocal(){ try{ return JSON.parse(localStorage.getItem(DB_KEY)); }catch(e){ return null; } }
function saveLocal(){ try{ localStorage.setItem(DB_KEY, JSON.stringify(STATE.properties)); }catch(e){} }

function showErr(msg){ var b=document.getElementById("errBanner"); document.getElementById("errText").textContent=msg; b.classList.add("show"); }
function clearErr(){ document.getElementById("errBanner").classList.remove("show"); }

async function api(action, payload){
  // LIVE のみ。失敗は throw。
  var body = Object.assign({ action:action, token:CONFIG.API_TOKEN }, payload||{});
  var res = await fetch(CONFIG.GAS_URL, { method:"POST", body:JSON.stringify(body),
    headers:{ "Content-Type":"text/plain;charset=utf-8" } }); // GASのCORS回避のためtext/plain
  if(!res.ok) throw new Error("HTTP "+res.status);
  var json = await res.json();
  if(!json.ok) throw new Error(json.error||"サーバーエラー");
  return json;
}

async function bootstrap(){
  if(LIVE){
    try{
      var j = await api("bootstrap", {});
      STATE.properties = j.properties;
      saveLocal(); clearErr();
      return;
    }catch(e){
      var cached = loadLocal();
      if(cached){ STATE.properties = cached; showErr("オフラインまたは通信失敗。保存済みの内容を表示中（"+e.message+"）"); }
      else { STATE.properties = []; showErr("通信に失敗しました: "+e.message); }
      return;
    }
  }
  // DEMO
  var local = loadLocal();
  STATE.properties = local || seed();
  if(!local) saveLocal();
}

/* 変更系: DEMOは即localStorage、LIVEは送信して失敗ならロールバック */
async function persist(action, payload, applyFn){
  applyFn();               // 楽観的更新
  saveLocal();
  render();
  if(LIVE){
    try{ await api(action, payload); clearErr(); }
    catch(e){ showErr("保存に失敗しました。時間をおいて再度お試しください（"+e.message+"）"); }
  }
}

/* =========================================================================
   集計（バッジ・残数・並び）
   ========================================================================= */
function phaseStat(p, phase){
  var items = MASTER[phase]||[];
  var done=0, total=items.length;
  items.forEach(function(it){ if((p.checks[keyOf(phase,it)]||{}).done) done++; });
  var dateISO = p.dates[phase];
  var d = parseISO(dateISO);
  var remaining = total-done;
  var status="none", label="", dleft=null;
  var allDone = (remaining===0);
  if(d){
    dleft = daysBetween(d, todayMid());
    if(!allDone && dleft<0) status="over";
    else if(!allDone && dleft<=7) status="soon";
    else status="ok";
  }
  return { total:total, done:done, remaining:remaining, date:d, dleft:dleft, status:status, allDone:allDone };
}
function propSummary(p){
  var remaining=0, worst="ok", nextPhase=null, nextStat=null, overCount=0;
  PHASES.forEach(function(ph){
    var s=phaseStat(p,ph);
    remaining += s.remaining;
    if(s.status==="over") overCount += s.remaining;
    if(!s.allDone && !nextPhase){ nextPhase=ph; nextStat=s; }
    if(s.status==="over") worst="over";
    else if(s.status==="soon" && worst!=="over") worst="soon";
  });
  var total=0,done=0; PHASES.forEach(function(ph){ var s=phaseStat(p,ph); total+=s.total; done+=s.done; });
  return { remaining:remaining, worst:worst, overCount:overCount, nextPhase:nextPhase, nextStat:nextStat,
           pct: total? Math.round(done/total*100):0, complete:(remaining===0) };
}

/* =========================================================================
   描画
   ========================================================================= */
function render(){
  document.body.classList.toggle("readonly", STATE.role==="view");
  document.getElementById("userLabel").textContent = STATE.user || "—";
  var v = document.getElementById("view-list").classList.contains("hidden") ? null : "list";
}

function renderList(){
  var el = document.getElementById("view-list");
  // 絞り込み候補は実データから生成（既知の並び順を優先し、新しい担当名も自動で拾う）
  var present={}; STATE.properties.forEach(function(p){ if(p.seisan) present[p.seisan]=1; });
  var ordered = SEISAN.filter(function(s){ return present[s]; })
    .concat(Object.keys(present).filter(function(s){ return SEISAN.indexOf(s)<0; }));
  var seisanOpts = ["全員"].concat(ordered);
  var list = STATE.properties.filter(function(p){ return STATE.filterSeisan==="全員" || p.seisan===STATE.filterSeisan; });
  // 並び: 期限超過→期限近い→順調
  var rank={over:0,soon:1,ok:2};
  list.sort(function(a,b){ return rank[propSummary(a).worst]-rank[propSummary(b).worst]; });

  var h = '';
  h += '<div class="filters">';
  h += '<div class="pick"><span class="k">生産担当</span><select onchange="setFilter(this.value)">'+
       seisanOpts.map(function(s){ return '<option '+(s===STATE.filterSeisan?"selected":"")+'>'+esc(s)+'</option>'; }).join("")+'</select></div>';
  h += '<div class="pick"><span class="k">並び順</span><select disabled><option>要対応が上</option></select></div>';
  h += '</div>';

  if(!list.length){
    h += '<div class="empty">表示できる物件がありません。<br>上の「物件を登録」から追加できます。</div>';
  }
  list.forEach(function(p){
    var s = propSummary(p);
    var badge = s.worst==="over" ? '<span class="pb pb-over">期限超過 '+s.overCount+'</span>'
      : s.worst==="soon" ? '<span class="pb pb-soon">'+esc(s.nextPhase)+' あと'+s.nextStat.dleft+'日</span>'
      : '<span class="pb pb-ok">順調</span>';
    var nextLabel = s.nextPhase ? (esc(s.nextPhase)+" "+(s.nextStat.date?fmtShort(s.nextStat.date):"未定")) : "全工程チェック済み";
    h += '<button class="prop-card '+(s.worst==="over"?"alert":"")+'" onclick="openProp(\''+p.id+'\')">'+
      '<div class="prop-head"><div class="prop-icon">'+IC.home+'</div>'+
      '<div class="prop-name">'+esc(p.name)+'</div>'+badge+'</div>'+
      '<div class="progress"><div class="progress-fill" style="width:'+s.pct+'%"></div></div>'+
      '<div class="prop-meta"><span>残り '+s.remaining+' 件</span><span class="r">'+nextLabel+' ｜ 生産：'+esc(p.seisan)+'</span></div>'+
      '</button>';
  });

  h += '<div class="legend"><h4>一覧の動き</h4><ul>'+
    '<li>開いた時は全物件を表示（矢橋林業は全現場を見る前提）</li>'+
    '<li>期限超過→期限が近い→順調 の順に自動で並ぶ</li>'+
    '<li>生産担当は左上のフィルタで自分の物件だけに絞れる</li>'+
    '<li>引渡しまで完了した物件は自動で消える（データも削除）</li>'+
    (LIVE?'':'<li style="color:var(--amber-ink)">現在はデモ表示（保存はこの端末内のみ）。本番接続でクラウド同期します</li>')+
    '</ul></div>';
  el.innerHTML = h;
}

function renderCheck(){
  var el = document.getElementById("view-check");
  var p = STATE.properties.find(function(x){ return x.id===STATE.currentId; });
  if(!p){ showView("list"); return; }

  var doneGroups=[], liveGroups=[];
  PHASES.forEach(function(ph){
    var s=phaseStat(p,ph);
    (s.allDone && s.total>0 ? doneGroups : liveGroups).push(ph);
  });

  var h='';
  h += '<div class="back-row"><button class="back-btn" onclick="showView(\'list\')">‹ 一覧</button>'+
       '<div class="back-title">'+IC.home+'<span>'+esc(p.name)+'</span></div>'+
       '<button class="edit-btn" onclick="editProperty()">編集</button></div>';
  var sm=propSummary(p);
  h += '<div class="prop-meta" style="margin:0 2px 12px;"><span>残り '+sm.remaining+' 件</span>'+
       '<span class="r">工務店：大澤・山川（矢橋林業）／生産：'+esc(p.seisan)+'</span></div>';

  if(doneGroups.length){
    h += '<button class="done-toggle" onclick="toggleDone()">完了した工程 '+doneGroups.length+' 件（'+doneGroups.map(esc).join("・")+'）　'+
         (STATE.showDone?'▾ 隠す':'▸ 表示')+'</button>';
    if(STATE.showDone){ doneGroups.forEach(function(ph){ h+=groupHTML(p,ph,true); }); }
  }
  liveGroups.forEach(function(ph){ h+=groupHTML(p,ph,false); });

  h += '<div class="legend"><h4>この画面の動き</h4><ul>'+
    '<li>矢橋林業がチェック → その行はグレーに沈み「いつ・誰が」が自動で残る</li>'+
    '<li>生産担当は閲覧モードで、実施状況を確認するだけ</li>'+
    '<li>節目の日付は右のペンをタップでいつでも変更</li>'+
    '<li>工程が全部終わると畳まれ、完了のひと言が出る</li>'+
    '<li>引渡しまで完了した物件はデータごと自動削除</li>'+
    '</ul></div>';
  el.innerHTML=h;
}

function groupHTML(p, phase, isDone){
  var s=phaseStat(p,phase);
  var cls = isDone ? "" : (s.status==="over"?"g-over":s.status==="soon"?"g-soon":"");
  var badge;
  if(isDone) badge='<span class="ms-badge b-open">完了</span>';
  else if(s.status==="over") badge='<span class="ms-badge b-over">期限超過 '+s.remaining+'</span>';
  else if(s.status==="soon") badge='<span class="ms-badge b-soon">あと'+s.dleft+'日</span>';
  else badge='';
  var dateHTML = s.date
    ? '<span class="ms-date" onclick="openCalFor(\''+p.id+'\',\''+phase+'\')">'+fmtShort(s.date)+'</span>'
    : '<span class="ms-date unset" onclick="openCalFor(\''+p.id+'\',\''+phase+'\')">日付：未定</span>';

  var h='<div class="ms-group '+cls+'">';
  if(isDone){
    var seed=0; for(var i=0;i<(p.id+phase).length;i++) seed+=(p.id+phase).charCodeAt(i);
    h+='<div class="done-banner">'+IC.check+'<span>'+esc(pickMsg(seed))+'</span></div>';
  }
  h+='<div class="ms-hdr"><span class="ms-name">'+esc(phase)+'</span>'+dateHTML+badge+'</div>';

  MASTER[phase].forEach(function(it){
    var c=p.checks[keyOf(phase,it)]||{};
    var who=PHASE_WHO[phase];
    var right = c.done
      ? '<span class="rec">'+esc(fmtAt(c.at))+" "+esc(c.by||"")+'</span>'
      : (s.status==="over" ? '<span class="due-tag b-over">'+Math.abs(s.dleft)+'日超過</span>' : '');
    h+='<div class="item '+(c.done?"done":"")+'">'+
       '<label class="cb-wrap"><input type="checkbox" class="cb" '+(c.done?"checked":"")+
       ' onchange="toggleCheck(\''+p.id+'\',\''+phase+'\',\''+esc(it).replace(/'/g,"&#39;")+'\',this.checked)"><span class="cb-icon"></span></label>'+
       '<div class="item-body"><div class="item-title">'+esc(it)+'</div>'+
       '<div class="item-sub"><span class="chip chip-'+who+'">'+who+'</span></div></div>'+
       '<div class="item-right">'+right+'</div></div>';
  });
  h+='</div>';
  return h;
}

/* =========================================================================
   操作
   ========================================================================= */
function setFilter(v){ STATE.filterSeisan=v; renderList(); }
function toggleDone(){ STATE.showDone=!STATE.showDone; renderCheck(); }
function openProp(id){ STATE.currentId=id; STATE.showDone=false; showView("check"); }

function toggleCheck(id, phase, item, checked){
  if(STATE.role==="view") return;
  var p=STATE.properties.find(function(x){return x.id===id;}); if(!p) return;
  var k=keyOf(phase,item);
  persist("check", { propId:id, phase:phase, item:item, checked:checked, user:STATE.user }, function(){
    var now=new Date();
    p.checks[k] = checked ? { done:true, by:STATE.user, at:fmtShort(now) } : { done:false };
  }).then(function(){
    // 全項目完了なら物件削除（引渡しまで含め全チェック）
    if(propSummary(p).complete){ farewellAndDelete(p); }
    else renderCheck();
  });
}

function farewellAndDelete(p){
  dialog("「"+p.name+"」は全工程が完了しました。おつかれさまでした。\nこの物件を一覧から削除します。", function(){
    persist("deleteProperty", { propId:p.id }, function(){
      STATE.properties = STATE.properties.filter(function(x){return x.id!==p.id;});
    }).then(function(){ showView("list"); });
  }, { okText:"完了して削除", cancelText:"あとで", onCancel:function(){ renderCheck(); } });
}

/* ---- 登録・編集フォーム ---- */
var editingId=null;
function newProperty(){ editingId=null; renderReg(null); showView("reg"); }
function editProperty(){ editingId=STATE.currentId; renderReg(STATE.properties.find(function(x){return x.id===editingId;})); showView("reg"); }

var regDates={};
function renderReg(p){
  regDates = {}; PHASES.forEach(function(ph){ regDates[ph]= p? (p.dates[ph]||"") : ""; });
  var el=document.getElementById("view-reg");
  var name=p?p.name:"", seisan=p?p.seisan:SEISAN[0];
  var h='';
  h+='<div class="card-head"><div class="card-title">物件情報</div></div><div class="form-card">';
  h+='<div class="field"><label class="field-label">物件名</label><input type="text" class="input" id="regName" value="'+esc(name)+'" placeholder="例：山田様邸"></div>';
  h+='<div class="field"><label class="field-label">生産担当 <span class="field-hint">（あとで変更可）</span></label><select class="fselect" id="regSeisan">'+
     SEISAN.map(function(s){return '<option '+(s===seisan?"selected":"")+'>'+esc(s)+'</option>';}).join("")+'</select></div>';
  h+='<div class="field"><label class="field-label">工務店担当 <span class="field-hint">（矢橋林業・2名1組で管理）</span></label>'+
     '<div class="pair"><div class="person"><span class="wdot wdot-大澤"></span>大澤 <span class="role">主に基礎</span></div>'+
     '<div class="person"><span class="wdot wdot-山川"></span>山川 <span class="role">建て方〜</span></div></div></div></div>';

  h+='<div class="card-head"><div class="card-title">節目の日付</div></div><div class="form-card">';
  h+='<div class="field" style="margin-bottom:10px;"><span class="field-hint">空欄のままでOK。タップでカレンダーが開きます。いつでも変更できます。</span></div>';
  h+='<div class="date-grid">';
  PHASES.forEach(function(ph){
    var label = ph==="着工前"?"着工":ph;
    var d=parseISO(regDates[ph]);
    h+='<label>'+esc(label)+'</label><button class="date-btn '+(d?"":"unset")+'" id="regd-'+ph+'" onclick="openCalReg(\''+ph+'\')">'+
       (d? (d.getFullYear()+"/"+(d.getMonth()+1)+"/"+d.getDate()) : "未定")+'</button>';
  });
  h+='</div></div>';

  h+='<div class="card-head"><div class="card-title">チェック項目</div></div><div class="form-card">'+
     '<div class="tmpl-note"><span>標準チェックリスト（39項目）が自動で入ります</span></div></div>';

  h+='<div class="btn-row"><button class="btn-primary" onclick="saveProperty()">保存する</button>'+
     '<button class="btn-ghost" onclick="showView(editingId?\'check\':\'list\')">キャンセル</button></div>';
  if(p) h+='<button class="btn-danger" onclick="confirmDelete(\''+p.id+'\')">この物件を削除</button>';
  el.innerHTML=h;
}
function saveProperty(){
  var name=document.getElementById("regName").value.trim();
  if(!name){ dialog("物件名を入力してください。", null, {okOnly:true}); return; }
  var seisan=document.getElementById("regSeisan").value;
  var dates={}; PHASES.forEach(function(ph){ dates[ph]=regDates[ph]||""; });
  if(editingId){
    var p=STATE.properties.find(function(x){return x.id===editingId;});
    persist("updateProperty", { propId:editingId, name:name, seisan:seisan, dates:dates }, function(){
      p.name=name; p.seisan=seisan; p.dates=dates;
    }).then(function(){ STATE.currentId=editingId; showView("check"); });
  }else{
    var id="p"+Date.now();
    persist("registerProperty", { propId:id, name:name, seisan:seisan, dates:dates }, function(){
      STATE.properties.push({ id:id, name:name, seisan:seisan, dates:dates, checks:buildChecks({}) });
    }).then(function(){ showView("list"); });
  }
}
function confirmDelete(id){
  var p=STATE.properties.find(function(x){return x.id===id;});
  dialog("「"+(p?p.name:"")+"」を削除します。よろしいですか？\n記録は元に戻せません。", function(){
    persist("deleteProperty", { propId:id }, function(){
      STATE.properties=STATE.properties.filter(function(x){return x.id!==id;});
    }).then(function(){ showView("list"); });
  }, { okText:"削除する", danger:true });
}

/* ---- 画面切替 ---- */
function showView(v){
  ["list","check","reg"].forEach(function(x){ document.getElementById("view-"+x).classList.toggle("hidden", x!==v); });
  document.getElementById("tab-list").classList.toggle("active", v==="list");
  document.getElementById("tab-reg").classList.toggle("active", v==="reg");
  if(v==="list") renderList();
  if(v==="check") renderCheck();
  window.scrollTo(0,0);
}

/* =========================================================================
   利用者選択
   ========================================================================= */
function renderIdOpts(){
  var work=USERS.filter(function(u){return u.role==="work";}), view=USERS.filter(function(u){return u.role==="view";});
  function opt(u){ return '<button class="id-opt" onclick="pickUser(\''+u.name+'\',\''+u.role+'\')">'+esc(u.name)+
    '<span class="badge '+(u.role==="work"?"role-work":"role-view")+'">'+(u.role==="work"?"チェック可":"閲覧のみ")+'</span></button>'; }
  document.getElementById("idOpts").innerHTML =
    '<div class="id-group"><div class="id-grouplabel">矢橋林業（チェックする人）</div>'+work.map(opt).join("")+'</div>'+
    '<div class="id-group"><div class="id-grouplabel">住友林業（確認する人）</div>'+view.map(opt).join("")+'</div>';
}
function openId(){ renderIdOpts(); document.getElementById("idOv").classList.add("open"); }
function pickUser(name, role){
  STATE.user=name; STATE.role=role;
  try{ localStorage.setItem(ME_KEY, JSON.stringify({user:name,role:role})); }catch(e){}
  document.getElementById("idOv").classList.remove("open");
  render(); renderList();
  maybeAskNotify(role);
}

/* =========================================================================
   通知（購読）— LIVE のみ実動作。DEMO は説明のみ。
   ========================================================================= */
function maybeAskNotify(role){
  if(!("Notification" in window)) return;
  if(Notification.permission==="granted"){ subscribePush(); return; }
  if(Notification.permission==="denied") return;
  dialog("期限が近づいたらこの端末にお知らせを送れます（"+(role==="work"?"担当する全物件":"自分の担当物件")+"）。通知を受け取りますか？",
    function(){ Notification.requestPermission().then(function(pm){ if(pm==="granted") subscribePush(); }); },
    { okText:"通知を受け取る", cancelText:"今はしない" });
}
function urlB64ToUint8(base64){
  var pad="=".repeat((4-base64.length%4)%4);
  var b=(base64+pad).replace(/-/g,"+").replace(/_/g,"/");
  var raw=atob(b), arr=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
  return arr;
}
async function subscribePush(){
  if(!LIVE || !CONFIG.VAPID_PUBLIC_KEY) return;
  try{
    var reg=await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:urlB64ToUint8(CONFIG.VAPID_PUBLIC_KEY) });
    await api("subscribe", { user:STATE.user, role:STATE.role, seisan:(STATE.role==="view"?STATE.user:null), subscription:sub });
  }catch(e){ /* 通知は任意なので黙って諦める */ }
}

/* =========================================================================
   汎用ダイアログ
   ========================================================================= */
function dialog(msg, onOk, opts){
  opts=opts||{};
  var ov=document.getElementById("dlgOv");
  document.getElementById("dlgMsg").innerHTML=esc(msg).replace(/\n/g,"<br>");
  var ok=document.getElementById("dlgOk"), cancel=document.getElementById("dlgCancel");
  ok.textContent=opts.okText||"OK";
  cancel.textContent=opts.cancelText||"キャンセル";
  cancel.style.display=opts.okOnly?"none":"";
  ok.style.background=opts.danger?"var(--red)":"var(--brand)";
  ov.classList.add("open");
  ok.onclick=function(){ ov.classList.remove("open"); if(onOk)onOk(); };
  cancel.onclick=function(){ ov.classList.remove("open"); if(opts.onCancel)opts.onCancel(); };
}

/* =========================================================================
   自前カレンダー（既存日付編集：iOSネイティブpickerの罠回避）
   ========================================================================= */
var calY,calM,calSel,calSelY,calSelM,calCtx;
var MON=["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
function openCalWith(iso, ctx){
  calCtx=ctx;
  var d=parseISO(iso)|| new Date();
  calY=d.getFullYear(); calM=d.getMonth();
  if(parseISO(iso)){ calSel=d.getDate(); calSelY=calY; calSelM=calM; } else { calSel=null; calSelY=calY; calSelM=calM; }
  renderCal(); document.getElementById("calBack").classList.add("open");
}
function openCalFor(id, phase){
  if(STATE.role==="view") return;
  var p=STATE.properties.find(function(x){return x.id===id;});
  openCalWith(p.dates[phase], { kind:"live", id:id, phase:phase });
}
function openCalReg(phase){ openCalWith(regDates[phase], { kind:"reg", phase:phase }); }
function closeCal(){ document.getElementById("calBack").classList.remove("open"); }
function calMove(delta){ calM+=delta; if(calM<0){calM=11;calY--;} if(calM>11){calM=0;calY++;} renderCal(); }
function renderCal(){
  document.getElementById("calTitle").textContent=calY+"年 "+MON[calM];
  var first=new Date(calY,calM,1).getDay();       // その月の1日の曜日
  var start=new Date(calY,calM,1-first);          // グリッド左上（前月にまたがる）
  var t=todayMid(), g=document.getElementById("calGrid"); g.innerHTML="";
  for(var i=0;i<42;i++){                            // 常に6週×7＝42セル固定＝高さ不変
    var cur=new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
    var b=document.createElement("button"); b.className="cal-cell"; b.textContent=cur.getDate();
    if(cur.getMonth()!==calM) b.classList.add("adjacent");
    if(calSel!==null && cur.getFullYear()===calSelY && cur.getMonth()===calSelM && cur.getDate()===calSel) b.classList.add("sel");
    if(cur.getFullYear()===t.getFullYear() && cur.getMonth()===t.getMonth() && cur.getDate()===t.getDate()) b.classList.add("today");
    (function(dt){ b.onclick=function(){ calPickDate(dt.getFullYear(), dt.getMonth(), dt.getDate()); }; })(cur);
    g.appendChild(b);
  }
}
function calPick(x){ calPickDate(null); }          // 「未定にする」ボタン用
function calPickDate(y,m,d){
  var iso = (y===null) ? "" : toISO(new Date(y,m,d));
  if(calCtx.kind==="reg"){
    regDates[calCtx.phase]=iso;
    var btn=document.getElementById("regd-"+calCtx.phase);
    if(iso){ var dd=parseISO(iso); btn.textContent=dd.getFullYear()+"/"+(dd.getMonth()+1)+"/"+dd.getDate(); btn.classList.remove("unset"); }
    else { btn.textContent="未定"; btn.classList.add("unset"); }
    closeCal();
  }else{
    var p=STATE.properties.find(function(x){return x.id===calCtx.id;});
    persist("updateDate", { propId:calCtx.id, phase:calCtx.phase, date:iso }, function(){
      p.dates[calCtx.phase]=iso;
    }).then(function(){ closeCal(); renderCheck(); });
  }
}
document.getElementById("calBack").addEventListener("click", function(e){ if(e.target===this) closeCal(); });

/* =========================================================================
   起動
   ========================================================================= */
async function start(){
  // 保存済みの利用者（ただし現在の名簿に居る人だけ復元。消えた名前は破棄して選び直し）
  try{
    var me=JSON.parse(localStorage.getItem(ME_KEY));
    if(me && USERS.some(function(u){ return u.name===me.user; })){ STATE.user=me.user; STATE.role=me.role; }
    else { localStorage.removeItem(ME_KEY); }
  }catch(e){}
  await bootstrap();
  render();
  if(!STATE.user){ openId(); }
  showView("list");
  // Service Worker
  if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(function(){}); }
}
start();
