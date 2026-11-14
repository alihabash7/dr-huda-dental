import firebase from 'firebase/compat/app';import 'firebase/compat/firestore';import fs from 'fs';
const src=fs.readFileSync('/home/user/huda-clinics/index.html','utf8');
const pick=re=>{const m=src.match(re);if(!m)throw new Error('missing '+re);return m[0]};
const code=[pick(/const itemKey=.*\n/),pick(/const isItemList=.*\n/),pick(/function mergePlan\(body,base\)\{[\s\S]*?\n  return \{first,second\}\}\n/),pick(/async function mergeWrite\(ref,body,base,fv\)\{[\s\S]*?catch\(e\)\{if\(e&&e.code==='not-found'\)return ref.set\(body\);throw e\}\}\n/)].join('');
const mergeWrite=new Function(code+';return mergeWrite')();
const mk=n=>{const a=firebase.initializeApp({projectId:'demo-merge',apiKey:'x'},n);const db=a.firestore();db.useEmulator('127.0.0.1',8085);return db};
const A=mk('A'),B=mk('B');const FV=firebase.firestore.FieldValue;const R=[];const ok=(n,c)=>R.push((c?'PASS ':'FAIL ')+n);
const base={patientId:'p1',fee:300000,discount:0,payments:[{id:'a',amount:100000,date:'2026-11-10'}],sessions:[],notes:'',updatedAt:'0'};
await A.doc('treatments/t1').set(base);
const snapA=(await A.doc('treatments/t1').get()).data(),snapB=(await B.doc('treatments/t1').get()).data();
// both offline, each adds a payment; B also edits the fee
await A.disableNetwork();await B.disableNetwork();
const a1=structuredClone(snapA);a1.payments.push({id:'b',amount:50000,date:'2026-11-14'});a1.updatedAt='1';
const b1=structuredClone(snapB);b1.payments.push({id:'c',amount:25000,date:'2026-11-14'});b1.fee=350000;b1.updatedAt='2';
const pa=mergeWrite(A.doc('treatments/t1'),a1,snapA,FV),pb=mergeWrite(B.doc('treatments/t1'),b1,snapB,FV);
await A.enableNetwork();await pa;await B.enableNetwork();await pb;
let d=(await A.doc('treatments/t1').get({source:'server'})).data();
ok('both offline payments kept ('+d.payments.map(x=>x.id).join(',')+')',['a','b','c'].every(i=>d.payments.some(x=>x.id===i))&&d.payments.length===3);
ok('fee change from device B kept ('+d.fee+')',d.fee===350000);
// offline: A edits payment a amount, B deletes payment b
const sA=(await A.doc('treatments/t1').get({source:'server'})).data(),sB=(await B.doc('treatments/t1').get({source:'server'})).data();
await A.disableNetwork();await B.disableNetwork();
const a2=structuredClone(sA);a2.payments=a2.payments.map(x=>x.id==='a'?{...x,amount:120000}:x);
const b2=structuredClone(sB);b2.payments=b2.payments.filter(x=>x.id!=='b');
const qa=mergeWrite(A.doc('treatments/t1'),a2,sA,FV),qb=mergeWrite(B.doc('treatments/t1'),b2,sB,FV);
await A.enableNetwork();await qa;await B.enableNetwork();await qb;
d=(await A.doc('treatments/t1').get({source:'server'})).data();
ok('edit on A + delete on B both applied ('+d.payments.map(x=>x.id+':'+x.amount).join(',')+')',d.payments.length===2&&d.payments.find(x=>x.id==='a').amount===120000&&!d.payments.some(x=>x.id==='b'));
// removed field
const s3=(await A.doc('treatments/t1').get({source:'server'})).data();const a3=structuredClone(s3);delete a3.notes;await mergeWrite(A.doc('treatments/t1'),a3,s3,FV);
d=(await A.doc('treatments/t1').get({source:'server'})).data();ok('removed field deleted',!('notes' in d));
// new doc
await mergeWrite(A.doc('treatments/t9'),{patientId:'p2',payments:[]},null,FV);ok('new record created',(await A.doc('treatments/t9').get()).exists);
// deleted on server meanwhile -> recreated
await B.doc('treatments/t9').delete();await mergeWrite(A.doc('treatments/t9'),{patientId:'p2',payments:[{id:'z',amount:1}]},{patientId:'p2',payments:[]},FV);ok('record deleted elsewhere is recreated',(await A.doc('treatments/t9').get({source:'server'})).exists);
console.log(R.join('\n'));process.exit(R.some(x=>x.startsWith('FAIL'))?1:0);
