/* Runs the clinics system outside claude.ai.
   Firebase login + Firestore stand in for the claude.ai capabilities the app uses (db, user, downloads),
   so the app code itself stays the same as the claude.ai version. */
(function(){
  "use strict";
  var C=window.FIREBASE_CONFIG;
  if(!C||!C.firebase||window.claude)return;
  window.STANDALONE=true;
  var inApp=/HudaApp\//.test(navigator.userAgent)||!!window.HudaAndroid;window.IN_APP=inApp;
  firebase.initializeApp(C.firebase);
  var auth=firebase.auth(),fs=firebase.firestore();
  try{fs.settings({ignoreUndefinedProperties:true,merge:true})}catch(e){}
  try{fs.enablePersistence({synchronizeTabs:true}).catch(function(){})}catch(e){}
  var owners=(C.ownerEmails||[]).map(function(e){return String(e).trim().toLowerCase()});
  var resolveUser,userReady=new Promise(function(r){resolveUser=r});
  var lower=function(s){return String(s||'').trim().toLowerCase()};

  /* ---------- login screen ---------- */
  var css=document.createElement('style');
  css.textContent=
   '#hl{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:20px;background:radial-gradient(70% 60% at 20% 10%,rgba(176,138,78,.25),transparent 70%),#0E3533;font-family:"IBM Plex Sans Arabic",system-ui,sans-serif;direction:rtl;color:#E6F0ED}'+
   '#hl[hidden]{display:none}#hl .bx{width:min(420px,100%);background:#fff;color:#0F201E;border-radius:22px;padding:30px 26px;box-shadow:0 30px 60px -20px rgba(0,0,0,.5);display:flex;flex-direction:column;gap:14px}'+
   '#hl .sig{font-family:"Aref Ruqaa",serif;font-size:34px;color:#7A5B28;text-align:center;line-height:1.2}#hl .sub{text-align:center;color:#71827E;font-size:13.5px;margin-top:-8px}'+
   '#hl h2{font-family:"El Messiri",serif;font-size:19px;margin:6px 0 0;text-align:center}#hl p{margin:0;font-size:14px;color:#465955;text-align:center}'+
   '#hl input{font-size:16px;font-family:inherit;width:100%;height:48px;border:1px solid #DCE5E2;border-radius:12px;padding:0 14px;background:#F6F8F7;color:#0F201E;box-sizing:border-box}'+
   '#hl input:focus{outline:none;border-color:#B08A4E;box-shadow:0 0 0 3px rgba(176,138,78,.2)}'+
   '#hl button{font-family:inherit;height:48px;border-radius:12px;border:1px solid #DCE5E2;background:#fff;color:#0F201E;font-size:15px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px}'+
   '#hl button.pr{background:#0E3533;color:#fff;border-color:#0E3533}#hl button:disabled{opacity:.6;cursor:default}'+
   '#hl .or{display:flex;align-items:center;gap:10px;color:#86A09A;font-size:12.5px}#hl .or::before,#hl .or::after{content:"";flex:1;height:1px;background:#DCE5E2}'+
   '#hl .lk{background:none;border:none;height:auto;color:#7A5B28;font-weight:500;font-size:13.5px;padding:2px}#hl .row{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}'+
   '#hl .msg{font-size:13.5px;text-align:center;min-height:20px}#hl .msg.bad{color:#B03E38}#hl .msg.ok{color:#17775F}';
  document.head.appendChild(css);
  var box=document.createElement('div');box.id='hl';box.hidden=true;box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
  document.body.appendChild(box);
  var mode='in';
  function msg(t,k){var m=box.querySelector('.msg');if(m){m.textContent=t||'';m.className='msg '+(k||'')}}
  function arErr(e){var c=(e&&e.code)||'';return c.indexOf('wrong-password')>=0||c.indexOf('invalid-credential')>=0||c.indexOf('user-not-found')>=0?'البريد أو كلمة المرور غير صحيحة':c.indexOf('email-already')>=0?'هذا البريد مسجّل مسبقاً، اختر «لدي حساب»':c.indexOf('weak-password')>=0?'كلمة المرور قصيرة، 8 أحرف على الأقل':c.indexOf('invalid-email')>=0?'البريد الإلكتروني غير صحيح':c.indexOf('unauthorized-domain')>=0?'الدخول بحساب Google غير مفعّل لهذا الرابط بعد. أضيفي «'+location.hostname+'» في Firebase ← Authentication ← Settings ← Authorized domains، أو ادخلي الآن بالبريد وكلمة المرور.':c.indexOf('popup')>=0?'أُغلقت نافذة Google قبل إكمال الدخول':c.indexOf('network')>=0?'لا يوجد اتصال بالإنترنت':c.indexOf('too-many')>=0?'محاولات كثيرة، انتظر قليلاً':'تعذّر الدخول ('+c+')'}
  function head(){return '<div class="sig">د. هدى ياسين</div><div class="sub">نظام إدارة عيادات طب الأسنان</div>'}
  function showLogin(){
    box.hidden=false;
    box.innerHTML='<form class="bx" id="hl-f" novalidate>'+head()+
     '<h2>'+(mode==='up'?'إنشاء حساب':'تسجيل الدخول')+'</h2>'+
     (inApp?'<p style="font-size:13px;color:#7A5B28;background:#F4EDE0;border-radius:10px;padding:8px 10px">اضغطي «الدخول بحساب Google»: يفتح المتصفح، تختارين حسابج، وتضغطين «العودة إلى التطبيق».</p>':'')+
     ('<button type="button" id="hl-g"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/></svg>الدخول بحساب Google</button>'+
     '<div class="or">أو بالبريد الإلكتروني</div>')+
     '<input id="hl-e" type="email" dir="ltr" autocomplete="email" placeholder="name@example.com" aria-label="البريد الإلكتروني">'+
     '<input id="hl-p" type="password" dir="ltr" autocomplete="'+(mode==='up'?'new-password':'current-password')+'" placeholder="'+(mode==='up'?'كلمة مرور جديدة (8 أحرف على الأقل)':'كلمة المرور')+'" aria-label="كلمة المرور">'+
     '<button class="pr" type="submit">'+(mode==='up'?'إنشاء الحساب':'دخول')+'</button>'+
     '<div class="row"><button type="button" class="lk" id="hl-m">'+(mode==='up'?'لدي حساب: تسجيل الدخول':'ليس لدي حساب: إنشاء حساب')+'</button>'+(mode==='up'?'':'<button type="button" class="lk" id="hl-r">نسيت كلمة المرور</button>')+'</div>'+
     '<div class="msg" role="status"></div></form>';
    var gb=box.querySelector('#hl-g');if(gb)gb.onclick=function(){msg('');
      if(inApp&&window.HudaAndroid&&window.HudaAndroid.googleLogin){try{window.HudaAndroid.googleLogin();msg('فتحنا المتصفح لتسجيل الدخول. بعد ما تخلصين ارجعي للتطبيق.','ok')}catch(e){msg('تعذّر فتح المتصفح','bad')}return}
      auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function(e){msg(arErr(e),'bad')})};
    box.querySelector('#hl-m').onclick=function(){mode=mode==='up'?'in':'up';showLogin()};
    var r=box.querySelector('#hl-r');if(r)r.onclick=function(){var em=lower(box.querySelector('#hl-e').value);if(!em)return msg('اكتب بريدك أولاً','bad');auth.sendPasswordResetEmail(em).then(function(){msg('أرسلنا رابط تغيير كلمة المرور إلى بريدك','ok')}).catch(function(e){msg(arErr(e),'bad')})};
    box.querySelector('#hl-f').onsubmit=function(ev){ev.preventDefault();var em=lower(box.querySelector('#hl-e').value),pw=box.querySelector('#hl-p').value;if(!em||!pw)return msg('اكتب البريد وكلمة المرور','bad');
      var b=box.querySelector('button.pr');b.disabled=true;msg('');
      var job=mode==='up'?auth.createUserWithEmailAndPassword(em,pw).then(function(c){return c.user.sendEmailVerification()}):auth.signInWithEmailAndPassword(em,pw);
      job.catch(function(e){msg(arErr(e),'bad');b.disabled=false})};
  }
  function showNote(title,text,actions){
    box.hidden=false;
    box.innerHTML='<div class="bx">'+head()+'<h2>'+title+'</h2><p>'+text+'</p>'+(actions||'')+'<button type="button" id="hl-out">تسجيل الخروج</button><div class="msg" role="status"></div></div>';
    box.querySelector('#hl-out').onclick=function(){auth.signOut()};
  }
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}

  /* ---------- who may enter: owners, or an email the owner allowed from «دعوة للدخول» ---------- */
  var current=null;
  auth.onAuthStateChanged(function(u){
    if(!u){if(current){location.reload();return}showLogin();return}
    var email=lower(u.email);
    if(!u.emailVerified){
      showNote('تأكيد البريد الإلكتروني','أرسلنا رسالة تأكيد إلى <b dir="ltr">'+esc(email)+'</b>. افتحها واضغط الرابط، ثم ارجع هنا واضغط «تحققت».','<button type="button" class="pr" id="hl-v">تحققت من بريدي</button><button type="button" id="hl-rs">إعادة إرسال رسالة التأكيد</button>');
      box.querySelector('#hl-v').onclick=function(){u.reload().then(function(){if(auth.currentUser.emailVerified)location.reload();else msg('لم يُؤكَّد البريد بعد','bad')})};
      box.querySelector('#hl-rs').onclick=function(){u.sendEmailVerification().then(function(){msg('أُعيد الإرسال','ok')}).catch(function(e){msg(arErr(e),'bad')})};
      return;
    }
    var owner=owners.indexOf(email)>=0;
    var check=owner?Promise.resolve(true):fs.collection('members').doc(email).get().then(function(d){return d.exists}).catch(function(){return false});
    check.then(function(ok){
      if(!ok){showNote('هذا الحساب غير مسموح له','الحساب <b dir="ltr">'+esc(email)+'</b> لم تُضِفه الإدارة بعد. اطلب من الإدارة إضافة بريدك من «دعوة للدخول» ثم أعد فتح الصفحة.');return}
      current=u;box.hidden=true;box.innerHTML='';
      fs.collection('people').doc(u.uid).set({name:u.displayName||email,email:email,lastSeen:new Date().toISOString()},{merge:true}).catch(function(){});
      resolveUser({uid:u.uid,email:email,name:u.displayName||email,owner:owner});
    });
  });

  /* ---------- the claude.ai capability surface the app expects ---------- */
  var nameCache={};
  window.claude={use:function(name){
    if(name==='db')return userReady.then(function(){return {collection:function(c){return fs.collection(c)}}});
    if(name==='user')return userReady.then(function(u){return {
      id:function(){return Promise.resolve(u.uid)},
      isOwner:function(){return Promise.resolve(u.owner)},
      canEdit:function(){return Promise.resolve(true)},
      me:function(){return Promise.resolve({id:u.uid,name:u.name})},
      profiles:function(ids){var out={};return Promise.all((ids||[]).map(function(id){
        if(nameCache[id]){out[id]=nameCache[id];return null}
        return fs.collection('people').doc(id).get().then(function(d){out[id]=nameCache[id]={name:d.exists?(d.data().name||''):''}}).catch(function(){out[id]={name:''}})
      })).then(function(){return out})}
    }});
    if(name==='downloads')return Promise.resolve({save:function(o){
      var mime=/\.json$/.test(o.filename)?'application/json':/\.html$/.test(o.filename)?'text/html':/\.csv$/.test(o.filename)?'text/csv':/\.png$/.test(o.filename)?'image/png':'application/octet-stream';
      var blob=o.data instanceof Blob?o.data:new Blob([o.data],{type:mime});
      if(window.HudaAndroid&&window.HudaAndroid.saveFile)return new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){try{window.HudaAndroid.saveFile(o.filename,blob.type||mime,String(fr.result).split(',')[1]||'');res({status:'saved'})}catch(e){rej({code:'unavailable'})}};fr.onerror=function(){rej({code:'unavailable'})};fr.readAsDataURL(blob)});
      var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=o.filename;document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},1500);return Promise.resolve({status:'saved'})}});
    return Promise.resolve(null);
  }};
  /* called by the Android app with the Google tokens it received from the browser sign-in page */
  window.hudaGoogleLogin=function(idToken,accessToken){
    try{var cred=firebase.auth.GoogleAuthProvider.credential(idToken,accessToken||null);
      if(box&&!box.hidden)msg('جارِ الدخول…','ok');
      return auth.signInWithCredential(cred).catch(function(e){showLogin();var c=(e&&e.code)||'';msg(c.indexOf('network')>=0?arErr(e):'تعذّر الدخول بحساب Google. أعيدي المحاولة من الزر.','bad')})}catch(e){showLogin();msg('تعذّر الدخول بحساب Google','bad')}};
  window.huda={signOut:function(){return auth.signOut()},email:function(){return current?lower(current.email):''}};
})();
