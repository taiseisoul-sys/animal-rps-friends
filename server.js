const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const rooms=new Map(),PORT=process.env.PORT||3000;
const HP=[180,150,160,200,250,300,280,180,300,160];
const SPECIAL=[2,0,0,1,0,2,0,2,2,1];
const DMG=[[40,70,100],[0,20,0],[120,50,0],[50,0,60],[100,40,0],[140,50,30],[200,0,0],[70,200,30],[60,40,50],[20,100,20]];
const MOVES=[['頭突き','角払い','トルネードスロー'],['ヴェノムエンド','毒針','ポイズンヒール'],['パワーバイト','アゴばさみ','アントガード'],['プレデタークロー','マンティスブレード','ハンティングステップ'],['キャットインパクト','ネコひっかき','甘える'],['プライドクラッシュ','キングスクラッチ','キングズロア'],['ゴライアスパンチ','ワイルドインパクト','貪る'],['イーグルクロー','ゴッドバード','スカイハント'],['クロコダイルテール','引き裂く爪','デビルバイト'],['遠吠え','ディノ・ラプトル・レイド','ラストダンス']];
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const win=(a,b)=>a===b?0:((a===0&&b===1)||(a===1&&b===2)||(a===2&&b===0)?1:-1);
function player(name,card,token){return {name,card,token,move:null,hp:HP[card],poison:0,streak:0,howl:0,lastHand:null,boost:false,seal:0,steel:0,attackBonus:0,counter:false,catLock:0,palmBlocked:false,roar:0,lionBonus:0,gorillaBonus:0,gorillaForce:false,gorillaDebt:0,gorillaSeal:-1,gorillaGuard:0,gorillaAttack:0};}

function gorillaStart(f,op){if(f.card!==6||f.hp<=0)return '';f.gorillaBonus=0;f.gorillaForce=false;const r=Math.random()*100;let msg='';if(r<30){f.gorillaBonus=20;msg='⚔️ 攻撃の各ヒット＋20';}else if(r<55){f.hp=Math.min(HP[6],f.hp+20);msg='💚 HP20回復';}else if(r<70){op.gorillaSeal=Math.floor(Math.random()*3);msg='🔒 相手の技を1つ封印';}else if(r<85){f.gorillaSeal=Math.floor(Math.random()*3);msg='❌ 自分の技を1つ封印';}else if(r<95){f.hp=Math.max(0,f.hp-20);msg='💔 HP20減少';}else if(r<97){f.hp=HP[6];msg='🍀 HP全回復';}else{f.gorillaForce=true;msg='👑 今ターン強制成功';}return '🦍 ジャングルキング：'+msg;}
function gorillaTurn(a,b){const notes=[];a.gorillaSeal=b.gorillaSeal=-1;for(const [f,op] of [[a,b],[b,a]]){const msg=gorillaStart(f,op);if(msg)notes.push(msg);}return notes;}

function rollLionAura(a,b){a.palmBlocked=b.card===5&&Math.random()<.7;b.palmBlocked=a.card===5&&Math.random()<.7;}
function publicRoom(r,token){const me=r.players.findIndex(p=>p.token===token);return {code:r.code,phase:r.phase,players:r.players.map(p=>({name:p.name,card:p.card,ready:p.move!==null,hp:p.hp,poison:p.poison,streak:p.streak,lastHand:p.lastHand,boost:p.boost,seal:p.seal,howl:p.howl,steel:p.steel,attackBonus:p.attackBonus,counter:p.counter,catLock:p.catLock,palmBlocked:p.palmBlocked,roar:p.roar,lionBonus:p.lionBonus,gorillaBonus:p.gorillaBonus,gorillaForce:p.gorillaForce,gorillaDebt:p.gorillaDebt,gorillaSeal:p.gorillaSeal,gorillaGuard:p.gorillaGuard,gorillaAttack:p.gorillaAttack})),you:me,round:r.round,history:r.history.slice(-15),winner:r.winner};}
function resolve(r){const [a,b]=r.players,ra=a.move,rb=b.move,result=win(ra,rb),notes=[];const roarA=a.roar>0,roarB=b.roar>0,outcome=a.gorillaDebt>0&&!b.gorillaDebt?-1:b.gorillaDebt>0&&!a.gorillaDebt?1:a.gorillaForce&&!b.gorillaForce?1:b.gorillaForce&&!a.gorillaForce?-1:roarA&&!roarB?1:roarB&&!roarA?-1:result;if(roarA||roarB)notes.push('👑 キングズロア：じゃんけん勝敗を上書き！');const before=[a.seal,b.seal],beforeLock=[a.catLock,b.catLock];
 // A seal lasts through the victim's next selection, including a lost or tied round.
 if(outcome===0){for(const [p,op] of [[a,b],[b,a]])if(p.card===2){p.steel+=10;notes.push(p.name+'：🛡️ 黒鋼鎧 永続攻撃力＋10（累計＋'+p.steel+'）');}a.hp=Math.max(0,a.hp-(b.card===2?20:a.card===2?0:10));b.hp=Math.max(0,b.hp-(a.card===2?20:b.card===2?0:10));a.streak=b.streak=0;notes.push(a.card===2||b.card===2?'あいこ：黒鋼鎧は被ダメージ0、相手は20ダメージ':'あいこ：両者10ダメージ');}
 else{const attacker=outcome===1?a:b,defender=outcome===1?b:a;let d=DMG[attacker.card][attacker.move],fixed=false;const predatorActive=attacker.card===3&&defender.hp>0&&defender.hp<=HP[defender.card]/2;
 if(attacker.card===0){
   if(attacker.move===1&&attacker.lastHand===1){d=35;fixed=true;notes.push(attacker.name+'：角払い連続使用 → 35ダメージ完全固定');}
   if(!fixed){if(attacker.move!==2&&attacker.boost){d=Math.floor(d*1.5);attacker.boost=false;notes.push(attacker.name+'：トルネード強化1.5倍！');}
     if(attacker.hp<=36){d=Math.floor(d*1.8);notes.push(attacker.name+'：底力発動！ 攻撃1.8倍');}}
   if(attacker.move===0&&Math.random()<.1){defender.seal=Math.max(defender.seal,1);notes.push(defender.name+'の必殺技を次の1ターン封印！');}
   if(attacker.move===2){attacker.boost=true;notes.push(attacker.name+'：次の通常技に1.5倍強化を付与！');}
 }
 if(attacker.card===2&&attacker.move!==2){d+=attacker.steel+attacker.attackBonus;notes.push(attacker.name+'：黒鋼鎧＋'+attacker.steel+'、技強化＋'+attacker.attackBonus);attacker.attackBonus=0;}
 if(attacker.card===9)d+=20*Math.floor((HP[9]-attacker.hp)/40);
 if(attacker.card===8&&attacker.streak===1)d*=2;
 if(attacker.card===8&&attacker.move===2&&attacker.streak===1)d=300;
 if(attacker.card===9&&attacker.move===1&&Math.random()<.5)d+=50;
 if(attacker.card===3){if(attacker.move===1){const old=defender.hp;d=old<=HP[defender.card]/2?old:Math.floor(old/2);notes.push(old<=HP[defender.card]/2?'🦗 マンティスブレード：即気絶！':'🦗 マンティスブレード：現在HPを半分に！');}else{if(predatorActive){d=Math.floor(d*1.5);notes.push('🧬 捕食者：攻撃1.5倍！');}if(attacker.move===2)notes.push('🦗 ハンティングステップ：'+d/3+'ダメージ×3回');}}
 if(attacker.card===1){
   if(attacker.move===0){if(defender.poison>0){d=defender.hp;notes.push(attacker.name+'：☠️ ヴェノムエンド成功！ 毒状態の相手を即気絶');}else notes.push(attacker.name+'：ヴェノムエンド失敗（相手は毒状態ではない）');}
   if(attacker.move===2){if(defender.poison>0){const beforeHp=attacker.hp;attacker.hp=Math.min(HP[1],attacker.hp+120);notes.push(attacker.name+'：💚 ポイズンヒール '+(attacker.hp-beforeHp)+'HP回復（最大150）');}else{defender.poison+=2;notes.push(defender.name+'に毒2ターン追加（ポイズンヒール）');}}
 }
 if(attacker.card===5){if(attacker.lionBonus&&attacker.move!==2){d+=attacker.lionBonus;notes.push('⚔️ キングスクラッチ強化＋'+attacker.lionBonus);attacker.lionBonus=0;}if(attacker.move===1){attacker.lionBonus+=30;notes.push('⚔️ 次の成功攻撃＋30');}if(attacker.move===2){attacker.roar=2;notes.push('👑 次ターン技が必ず成功！');}}
 if(attacker.card===7&&attacker.move===1)attacker.hp=Math.min(attacker.hp,10);
 
 if(attacker.card===9&&attacker.move===0)attacker.howl+=30;
 if(attacker.card===9&&attacker.move===1){d+=attacker.howl;attacker.howl=0;}
 if(attacker.card===1&&attacker.move===1){defender.poison+=3;notes.push(defender.name+'に毒3ターン追加（毒針）');}
 if(attacker.card===2){if(attacker.move===0){attacker.attackBonus+=10;notes.push(attacker.name+'：次の攻撃＋10');}if(attacker.move===1){attacker.attackBonus+=20;notes.push(attacker.name+'：次の攻撃＋20');}if(attacker.move===2){attacker.counter=true;notes.push(attacker.name+'：🛡️ アントガード カウンター待機');}}
 if(attacker.card===4&&attacker.move===2){defender.catLock=3;notes.push(defender.name+'：🐾 甘える 3ターン連続同手禁止');}if(attacker.card===6){if(attacker.move===0){attacker.gorillaDebt=2;notes.push('🦍 次ターン自分失敗・相手成功');}if(attacker.move===2){const r=Math.random()*100;if(r<30){const old=attacker.hp;attacker.hp=Math.min(HP[6],attacker.hp+50);notes.push('🍌 HP'+(attacker.hp-old)+'回復');}else if(r<60){attacker.gorillaAttack+=20;notes.push('🍌 次の技＋20');}else if(r<90){attacker.gorillaGuard+=20;notes.push('🍌 次の被ダメージ−20');}else if(r<91){attacker.roar=2;notes.push('🍌 次ターン強制成功');}else{attacker.hp=Math.max(0,attacker.hp-30);notes.push('🤢 HP−30');}}if(attacker.move===1){notes.push('🦍 ワイルドインパクト：6回コイントス');n=0;}}const multi=(attacker.card===3&&attacker.move===2)||(attacker.card===4&&attacker.move===1),specialEffect=attacker.card===3&&attacker.move===1;
const hits=attacker.card===6&&attacker.move===1?Array.from({length:6},()=>Math.random()<.5?20:0):attacker.card===4&&attacker.move===1?[20,20]:multi?[d/3,d/3,d/3]:[d];let dealt=0;
for(let hit=0;hit<hits.length;hit++){
 if(defender.hp<=0||attacker.hp<=0)break;
 const actualDamage=Math.min(Math.max(0,defender.hp),Math.max(0,hits[hit]+(hits[hit]>0&&attacker.card===6?attacker.gorillaBonus:0)+(hits[hit]>0&&attacker.gorillaAttack?attacker.gorillaAttack:0)-(defender.gorillaGuard>0?defender.gorillaGuard:0)));
 defender.hp-=actualDamage;dealt+=actualDamage;if(hits[hit]>0){attacker.gorillaAttack=0;defender.gorillaGuard=0;}if(attacker.card===6&&attacker.move===1)notes.push('🪙 '+(hit+1)+'回目：'+(hits[hit]?'表 '+actualDamage+'ダメージ':'裏')); 
 if(multi)notes.push(attacker.name+'：'+(hit+1)+'発目 '+actualDamage+'ダメージ');
 if(attacker.card===4&&attacker.move===1&&actualDamage>0){const heal=Math.min(HP[4]-attacker.hp,Math.floor(actualDamage/2));attacker.hp+=heal;notes.push(attacker.name+'：🐈 ネコひっかき '+(hit+1)+'発目 実ダメージ'+actualDamage+' / '+heal+'HP回復');}if(attacker.card===4&&attacker.move===0&&actualDamage>0){const heal=Math.min(HP[4]-attacker.hp,30);attacker.hp+=heal;notes.push(attacker.name+'：🐈 キャットインパクト '+heal+'HP回復');}if(predatorActive&&!specialEffect){const heal=Math.min(HP[3]-attacker.hp,Math.floor(actualDamage*.3));if(heal>0){attacker.hp+=heal;notes.push(attacker.name+'：💚 捕食者 '+heal+'HP回復'+(multi?'（'+(hit+1)+'発目）':''));}}
 if(!specialEffect&&defender.card===2&&defender.counter&&actualDamage>0){const reflected=Math.floor(actualDamage/2)+defender.steel+defender.attackBonus;attacker.hp=Math.max(0,attacker.hp-reflected);notes.push(defender.name+'：🛡️ アントガード反射 '+reflected+'ダメージ（技強化'+defender.attackBonus+'消費）');defender.attackBonus=0;defender.counter=false;}
}
if(attacker.card===5&&attacker.move===0){attacker.hp=Math.max(0,attacker.hp-50);notes.push(attacker.name+'：🦁 プライドクラッシュ反動50ダメージ');}d=dealt;notes.push(attacker.name+'の'+MOVES[attacker.card][attacker.move]+'：'+(specialEffect?d+'HP減少（特殊効果）':d+'ダメージ'));attacker.streak++;defender.streak=0;
 }
 for(let i=0;i<2;i++){const p=r.players[i];if(p.gorillaDebt>0)p.gorillaDebt--;if(p.roar>0)p.roar--;p.lastHand=p.move;if(beforeLock[i]>0)p.catLock=Math.max(0,p.catLock-1);if(before[i]>0)p.seal=Math.max(0,p.seal-1);if(p.poison>0&&p.hp>0){p.hp=Math.max(0,p.hp-20);p.poison--;notes.push(p.name+'に毒20ダメージ（残り'+p.poison+'ターン）');}if(p.card===4&&p.hp>0){const heal=Math.min(10,HP[4]-p.hp);p.hp+=heal;notes.push(p.name+'：🐈 ゴロゴロ回復 '+heal+'HP回復');}}
 rollLionAura(a,b);notes.push(...gorillaTurn(a,b));r.history.push({round:r.round,hands:[ra,rb],result,notes,hp:[a.hp,b.hp]});a.move=b.move=null;
 if(a.hp===0||b.hp===0){r.phase='finished';r.winner=a.hp===b.hp?'draw':a.hp>0?0:1;}else r.round++;
}
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');
 if(req.method==='GET'&&url.pathname==='/api/room'){const r=rooms.get(url.searchParams.get('code')),token=url.searchParams.get('token');if(!r||!r.players.some(p=>p.token===token))return json(res,404,{error:'ルームが見つかりません'});return json(res,200,publicRoom(r,token));}
 if(req.method==='POST'&&url.pathname.startsWith('/api/')){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)return json(res,413,{error:'too large'});}let data;try{data=JSON.parse(raw);}catch{return json(res,400,{error:'bad json'});}const name=String(data.name||'PLAYER').slice(0,20),card=Number(data.card);
 if(['/api/create','/api/join'].includes(url.pathname)&&(!Number.isInteger(card)||card<0||card>9||data.card===undefined||data.card===null||data.card===''))return json(res,400,{error:'カードを選択してください'});
 if(url.pathname==='/api/create'){let code;do{code=String(100000+Math.floor(Math.random()*900000));}while(rooms.has(code));const token=crypto.randomBytes(18).toString('hex');rooms.set(code,{code,phase:'waiting',round:1,players:[player(name,card,token)],history:[],winner:null,updated:Date.now()});return json(res,200,{code,token});}
 if(url.pathname==='/api/join'){const r=rooms.get(String(data.code||''));if(!r||r.players.length!==1||r.phase!=='waiting')return json(res,400,{error:'参加できないルームです'});const token=crypto.randomBytes(18).toString('hex');r.players.push(player(name,card,token));r.phase='playing';r.updated=Date.now();if(r.players[0].card===1)r.players[1].poison=5;if(card===1)r.players[0].poison=5;rollLionAura(r.players[0],r.players[1]);r.gorillaNotes=gorillaTurn(r.players[0],r.players[1]);return json(res,200,{code:r.code,token});}
 if(url.pathname==='/api/move'){const r=rooms.get(String(data.code||'')),p=r?.players.find(p=>p.token===data.token);if(!p||r.phase!=='playing')return json(res,400,{error:'対戦中ではありません'});const hand=Number(data.hand);if(![0,1,2].includes(hand)||p.move!==null)return json(res,400,{error:'手を選べません'});if(hand===SPECIAL[p.card]&&p.seal>0)return json(res,400,{error:'必殺技は封印されています'});if(p.catLock>0&&hand===p.lastHand)return json(res,400,{error:'甘える：直前と同じ手は選べません'});if(p.gorillaSeal===hand)return json(res,400,{error:'ジャングルキング：技が封印されています'});if(p.palmBlocked&&hand===2)return json(res,400,{error:'王者の領域：✋は封印中です'});if(p.card===5&&hand===2&&p.lastHand===2)return json(res,400,{error:'キングズロアは2回連続で使用できません'});p.move=hand;r.updated=Date.now();if(r.players.every(x=>x.move!==null))resolve(r);return json(res,200,{ok:true});}
 return json(res,404,{error:'not found'});}
 let file=url.pathname==='/'?'/index.html':url.pathname;const full=path.resolve(__dirname,'.'+file);if(!full.startsWith(__dirname+path.sep))return json(res,403,{error:'forbidden'});fs.readFile(full,(err,buf)=>{if(err)return json(res,404,{error:'not found'});res.writeHead(200,{'Content-Type':full.endsWith('.html')?'text/html; charset=utf-8':'text/plain; charset=utf-8'});res.end(buf);});});
setInterval(()=>{for(const [code,r] of rooms)if(Date.now()-r.updated>14400000)rooms.delete(code);},600000).unref();if(require.main===module)server.listen(PORT,()=>console.log('Animal RPS listening on '+PORT));module.exports={server,resolve,player,publicRoom};
