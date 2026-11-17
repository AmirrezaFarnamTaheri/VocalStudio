/** The game worlds are drawn locally from lightweight vector primitives. */
import { targetAt } from './games-core.js';

const TAU=Math.PI*2;
function circle(ctx,x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=fill;ctx.fill();}
function line(ctx,a,b,c,d,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(c,d);ctx.stroke();}
function label(ctx,str,x,y,size=17,color='#f7f2e8',align='center',weight=650){ctx.fillStyle=color;ctx.font=`${weight} ${size}px system-ui, sans-serif`;ctx.textAlign=align;ctx.fillText(str,x,y);}
function round(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function background(ctx,W,H,top,bottom){const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,top);grad.addColorStop(1,bottom);ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);}
function stars(ctx,t,W,H,amount=44){for(let i=0;i<amount;i++){const x=((i*193.7+37)%W),y=((i*101.9+33)%(H*.7)),glow=.5+.5*Math.sin(t*.0018+i*2.45);circle(ctx,x,y,i%6===0?2:1,`rgba(255,245,224,${.17+glow*.44})`);}}
function glow(ctx,x,y,r,color){const grad=ctx.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,color);grad.addColorStop(1,'transparent');circle(ctx,x,y,r,grad);}
function noteBadge(ctx,x,y,note,title){glow(ctx,x,y,66,'rgba(245,193,105,.22)');round(ctx,x-47,y-29,94,58,16,'#ffffff18');ctx.strokeStyle='#ffffff55';ctx.lineWidth=1;ctx.strokeRect(x-47,y-29,94,58);label(ctx,note,x,y+5,28);if(title)label(ctx,title,x,y+51,12,'#cddcda');}
function drawNoteRunner(ctx,g,W,H,t){
 background(ctx,W,H,'#0e2431','#162826');stars(ctx,t,W,H*.65,57);
 for(let n=0;n<4;n++){const yy=210+n*36;ctx.beginPath();ctx.moveTo(0,yy);for(let x=0;x<=W;x+=24)ctx.lineTo(x,yy+11*Math.sin(x/80+n+t*.00014));ctx.strokeStyle=`rgba(59,166,157,${.14+n*.04})`;ctx.lineWidth=2;ctx.stroke();}
 const floor=H*.73;ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(W,H);ctx.lineTo(W*.91,floor);ctx.lineTo(W*.12,floor);ctx.closePath();ctx.fillStyle='#243a3b';ctx.fill();
 for(let i=0;i<6;i++){const yy=floor+((H-floor)*i/5);line(ctx,W*.12*(1-i/5),yy,W-W*.09*(1-i/5),yy,'#c7b88a30',2);}
 const target=targetAt(g)||g.targets.at(-1);const degree=target?.degree??0;
 const targetY=155+Math.sin(degree*1.52)*55;
 const elapsed=Math.max(0,t-(g.targetStartedAt??t));const amount=Math.min(1,elapsed/g.config.timeoutMs);const gx=W*.79-amount*W*.49;
 const gap=115;ctx.shadowColor='#f3bd78';ctx.shadowBlur=20;
 round(ctx,gx-38,0,77,targetY-gap/2,10,'#ba885e');round(ctx,gx-38,targetY+gap/2,77,H-(targetY+gap/2),10,'#ba885e');ctx.shadowBlur=0;
 for(let k=0;k<7;k++){line(ctx,gx-34+k*11,0,gx-34+k*11,targetY-gap/2,'#e3c39d34');line(ctx,gx-34+k*11,targetY+gap/2,gx-34+k*11,H,'#e3c39d34');}
 round(ctx,gx-65,targetY-37,130,74,22,'#123e4c');label(ctx,target?.label??'Do',gx,targetY+10,36,'#f7e9bb', 'center',750);
 const lane=g.lastInputMidi===null?targetY+40:targetY-(g.lastInputMidi-target.midi)*18;
 glow(ctx,W*.23,lane,66,'rgba(255,201,115,.33)');circle(ctx,W*.23,lane,23,'#faaf62');circle(ctx,W*.23-6,lane-7,7,'#fff0be');
 label(ctx,g.source==='keys'?'CHOOSE THE MATCHING NOTE':'HOLD THE NOTE TO OPEN THE GATE',W*.49,34,12,'#b3cbcb','center',700);
}
function drawSkySteps(ctx,g,W,H,t){
 background(ctx,W,H,'#20284c','#497c96');stars(ctx,t,W,H,30);
 glow(ctx,W*.76,H*.19,150,'rgba(245,223,171,.25)');circle(ctx,W*.76,H*.19,48,'#ffdfa9');
 for(let i=0;i<6;i++){const cx=((i*179+80+t*.007)%(W+170))-80,cy=H*.35+(i%4)*70;round(ctx,cx-90,cy-16,180,32,16,'#e5f7f31a');}
 for(let j=0;j<g.targets.length;j++){
  const x=W*(.12+.77*j/Math.max(1,g.targets.length-1)),dy=g.targets[j].degree??0,y=H*.76-dy*36;
  const active=j===g.index,done=j<g.index;
  glow(ctx,x,y,active?85:40,active?'rgba(251,213,132,.28)':'rgba(173,205,236,.14)');
  round(ctx,x-37,y+12,74,14,7,done?'#9ce0d2':active?'#ffd895':'#b0bfdc');
  round(ctx,x-30,y+24,60,12,5,'#263a59');
  label(ctx,g.targets[j].label,x,y+2,active?21:14,active?'#fff2c5':'#d0e2e8');
 }
 const at=g.targets[Math.min(g.index,g.targets.length-1)]||{degree:0};const x=W*(.12+.77*Math.min(g.index,g.targets.length-1)/Math.max(1,g.targets.length-1)),y=H*.76-(at.degree??0)*36;
 glow(ctx,x,y-40,50,'rgba(242,244,255,.35)');circle(ctx,x,y-42+Math.sin(t*.004)*4,17,'#fff2cf');circle(ctx,x-4,y-46+Math.sin(t*.004)*4,5,'#fff');
 label(ctx,'MAKE THE NEXT STEP GLOW',W*.5,35,12,'#e7e7ff');
}
function drawEchoCave(ctx,g,W,H,t){
 background(ctx,W,H,'#190f2d','#2a2255');stars(ctx,t,W,H,64);
 for(let i=0;i<6;i++){const x=(i+.5)/6*W,y=H*.24+Math.sin(i*2.1)*38;glow(ctx,x,y,110,'rgba(149,90,225,.13)');}
 const total=g.targets.length;for(let i=0;i<total;i++){
  const x=W*(.1+.8*(i+.5)/total),y=H*.55+Math.sin(i*1.3)*43;const active=i===g.index,done=i<g.index,r=active?38:27;
  glow(ctx,x,y,r*2.7,active?'rgba(230,171,255,.26)':done?'rgba(132,226,221,.24)':'rgba(114,92,191,.12)');
  ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r*.75,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r*.75,y);ctx.closePath();ctx.fillStyle=done?'#82e7d1':active?'#dda8ff':'#7b6aaf';ctx.fill();
  label(ctx,active?'?':(done?'✓':'?'),x,y+7,active?20:15,'#2a1c42');
  if(i<total-1)line(ctx,x+r,y,W*(.1+.8*(i+1.5)/total)-r,y+Math.sin((i+1)*1.3)*43,'#d5b6ef44',2);
 }
 label(ctx,'LISTEN • REMEMBER • SING',W*.5,52,13,'#e4d9f7');
}
function drawGarden(ctx,g,W,H,t){
 background(ctx,W,H,'#0d2d35','#254e42');stars(ctx,t,W,H,37);
 const floor=H*.75;round(ctx,0,floor,W,H-floor,0,'#1b453d');
 for(let i=0;i<18;i++){const x=i*W/17;line(ctx,x,floor+40,x+12,floor-21-Math.sin(t*.0007+i)*12,'#61ab8655',2);}
 for(let i=0;i<g.targets.length;i++){
  const x=W*(.12+.76*i/Math.max(1,g.targets.length-1)),done=i<g.index,active=i===g.index;
  const bloom=done?1:active?.28+.72*Math.min(1,g.heldMs/(g.config.holdMs*2.6)):.12;
  glow(ctx,x,floor-50,85,done?'rgba(144,245,181,.26)':'rgba(246,206,140,.19)');
  line(ctx,x,floor,x,floor-42,'#73caa0',5);
  for(let petal=0;petal<7;petal++){const a=petal*TAU/7+t*.00015,r=17+23*bloom;circle(ctx,x+Math.cos(a)*r,yClamp(floor-55+Math.sin(a)*r,25,H-5),7+9*bloom,done?'#b7f1ba':active?'#f5ce91':'#558b83');}
  circle(ctx,x,floor-55,9+9*bloom,done?'#fef2bb':'#ffda9f');
  label(ctx,g.targets[i].label,x,floor+42,14,active?'#fff0c8':'#a8c9c0');
 }
 label(ctx,'GROW A FLOWER WITH A GENTLE HELD NOTE',W*.5,38,12,'#bee0d8');
}
function yClamp(v,a,b){return Math.max(a,Math.min(b,v));}
function drawRiver(ctx,g,W,H,t){
 background(ctx,W,H,'#082e44','#245f72');stars(ctx,t,W,H*.6,35);
 const horizon=H*.48;glow(ctx,W*.76,H*.22,90,'rgba(255,219,145,.24)');circle(ctx,W*.76,H*.22,31,'#fff0b7');
 for(let i=0;i<12;i++){const y=horizon+i*17;ctx.beginPath();for(let x=0;x<W;x+=12){const yy=y+3*Math.sin((x+t*.17)/32+i*2);if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.strokeStyle=`rgba(157,220,236,${.07+i*.011})`;ctx.lineWidth=2;ctx.stroke();}
 const now=t-(g.startedAt??t),beat=targetAt(g),offset=beat?.offsetMs??0;
 for(let i=0;i<g.targets.length;i++){
  const b=g.targets[i];const x=W*.34+(b.offsetMs-now)*.13;
  if(x<0||x>W+45)continue;
  const active=i===g.index,done=i<g.index;
  glow(ctx,x,horizon+64,active?55:30,'rgba(255,218,143,.18)');
  ctx.beginPath();ctx.moveTo(x-20,horizon+74);ctx.lineTo(x+20,horizon+74);ctx.lineTo(x+11,horizon+84);ctx.lineTo(x-13,horizon+84);ctx.closePath();ctx.fillStyle=done?'#87cfc1':active?'#f6c98c':'#7eafbc';ctx.fill();
  line(ctx,x,horizon+73,x,horizon+44,'#b5dfe6',2);circle(ctx,x,horizon+42,7,active?'#fff6be':'#f0daac');
 }
 line(ctx,W*.34,horizon+15,W*.34,H,'#fff0bcaa',3);
 circle(ctx,W*.34,horizon+64,25,'rgba(249,214,154,.12)');
 label(ctx,'SING “TA” OR TAP AS THE BOAT MEETS THE LIGHT',W*.5,36,12,'#d6f0f1');
}
export function drawGameScene(canvas,session,{time=0}={}){
 if(!canvas||!session)return;
 const rect=canvas.getBoundingClientRect();const width=rect.width||900;const height=rect.height||420;const dpr=Math.min(2,globalThis.devicePixelRatio||1);
 if(canvas.width!==Math.ceil(width*dpr)||canvas.height!==Math.ceil(height*dpr)){canvas.width=Math.ceil(width*dpr);canvas.height=Math.ceil(height*dpr);}
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const W=width<540?600:960,H=460,t=time;
 ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);
 if(session.mode==='sky-steps')drawSkySteps(ctx,session,W,H,t);
 else if(session.mode==='echo-cave')drawEchoCave(ctx,session,W,H,t);
 else if(session.mode==='tone-garden')drawGarden(ctx,session,W,H,t);
 else if(session.mode==='rhythm-river')drawRiver(ctx,session,W,H,t);
 else drawNoteRunner(ctx,session,W,H,t);
 // Progress dots are part of the artwork, while accessible status stays in DOM.
 const radius=5,pad=12,w=Math.min(400,session.targets.length*22),x0=(W-w)/2;
 for(let i=0;i<session.targets.length;i++)circle(ctx,x0+(i+.5)*w/session.targets.length,H-21,radius,i<session.index?'#b6f2d8':i===session.index?'#ffe5a8':'#ffffff50');
}
