const $ = id => document.getElementById(id);
const form = $('solverForm');
let lastGraphData = null;

function compileExpression(source) {
  let s = String(source).trim().toLowerCase();
  if (!s) throw new Error('اكتب الدالة والمشتقة أولاً.');
  if (!/^[0-9x+\-*/^()., _a-z]+$/i.test(s)) throw new Error('يوجد رمز غير مسموح داخل المعادلة.');
  const allowed = new Set(['x','sin','cos','tan','sqrt','log','ln','exp','abs','asin','acos','atan','pi','e']);
  const words = s.match(/[a-z]+/g) || [];
  for (const word of words) if (!allowed.has(word)) throw new Error(`العنصر “${word}” غير مدعوم.`);
  s = s.replace(/\^/g,'**').replace(/\bln\b/g,'log');
  const map = ['sin','cos','tan','sqrt','log','exp','abs','asin','acos','atan'];
  for (const name of map) s = s.replace(new RegExp(`\\b${name}\\b`,'g'),`Math.${name}`);
  s = s.replace(/\bpi\b/g,'Math.PI').replace(/\be\b/g,'Math.E');
  const fn = new Function('x', `"use strict"; return (${s});`);
  return x => {
    const value = Number(fn(x));
    if (!Number.isFinite(value)) throw new Error('نتجت قيمة غير صالحة. راجع الدالة والقيمة الابتدائية.');
    return value;
  };
}

const fmt = n => Number.isFinite(n) ? Number(n).toPrecision(10).replace(/(?:\.0+|(?:(\.\d*?[1-9]))0+)$/,'$1') : '—';

function solve(event) {
  event.preventDefault();
  $('error').textContent = '';
  try {
    const f = compileExpression($('functionInput').value);
    const df = compileExpression($('derivativeInput').value);
    let x = Number($('x0Input').value);
    const maxIterations = Math.min(50, Math.max(1, Math.trunc(Number($('iterationsInput').value))));
    const tolerance = Number($('toleranceInput').value);
    if (!Number.isFinite(x)) throw new Error('أدخل قيمة صحيحة لـ x₀.');
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error('درجة الدقة يجب أن تكون صفراً أو قيمة موجبة.');

    const steps = [];
    const path = [x];
    let converged = false;
    for (let i=0; i<maxIterations; i++) {
      const fx = f(x), dfx = df(x);
      if (Math.abs(dfx) < 1e-14) throw new Error(`المشتقة تساوي تقريباً صفراً عند x = ${fmt(x)}، لذلك لا يمكن إكمال القسمة.`);
      const next = x - fx / dfx;
      if (!Number.isFinite(next)) throw new Error('تعذر حساب القيمة التالية.');
      const difference = Math.abs(next-x);
      steps.push({i,x,fx,dfx,next,difference});
      path.push(next);
      x = next;
      if (difference <= tolerance || Math.abs(f(x)) <= tolerance) { converged=true; break; }
    }

    $('rootValue').textContent = fmt(x);
    $('residualValue').textContent = fmt(Math.abs(f(x)));
    $('statusValue').textContent = converged ? 'تم التقارب' : 'اكتملت التكرارات';
    $('iterationsValue').textContent = steps.length;
    $('path').innerHTML = path.map((v,i)=>`${i?'<span class="arrow">→</span>':''}<span class="node">x<sub>${i}</sub> = ${fmt(v)}</span>`).join('');
    const xs = path.slice();
    const padding = Math.max(1, (Math.max(...xs)-Math.min(...xs))*1.5);
    if (!$('chartMin').value || !$('chartMax').value) { $('chartMin').value = fmt(Math.min(...xs)-padding); $('chartMax').value = fmt(Math.max(...xs)+padding); }
    lastGraphData = {f, df, steps, root:x};
    drawGraph();
    $('stepsBody').innerHTML = steps.map(s=>`<tr><td>${s.i}</td><td>${fmt(s.x)}</td><td>${fmt(s.fx)}</td><td>${fmt(s.dfx)}</td><td>${fmt(s.next)}</td><td>${fmt(s.difference)}</td></tr>`).join('');
    $('results').classList.remove('hidden');
    $('results').scrollIntoView({behavior:'smooth',block:'start'});
  } catch (err) {
    $('results').classList.add('hidden');
    $('error').textContent = err.message || 'حدث خطأ أثناء الحساب.';
  }
}

form.addEventListener('submit', solve);
$('resetBtn').addEventListener('click',()=>{
  $('functionInput').value='x^3 - x - 2'; $('derivativeInput').value='3*x^2 - 1';
  $('x0Input').value='2'; $('iterationsInput').value='3'; $('toleranceInput').value='0.000001';
  $('error').textContent=''; $('results').classList.add('hidden');
});
form.dispatchEvent(new Event('submit',{cancelable:true}));


function drawGraph() {
  if (!lastGraphData) return;
  const canvas = $('functionChart'), ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.parentElement.clientWidth - 20;
  const cssH = Math.max(320, Math.min(520, cssW * .52));
  canvas.width = Math.round(cssW*dpr); canvas.height = Math.round(cssH*dpr);
  canvas.style.width=cssW+'px'; canvas.style.height=cssH+'px'; ctx.scale(dpr,dpr);
  const W=cssW,H=cssH,m={l:58,r:22,t:24,b:46};
  let xmin=Number($('chartMin').value), xmax=Number($('chartMax').value);
  if(!Number.isFinite(xmin)||!Number.isFinite(xmax)||xmin>=xmax){$('error').textContent='مجال الرسم غير صحيح.';return;}
  const {f,df,steps}=lastGraphData, samples=[];
  for(let i=0;i<=500;i++){const x=xmin+(xmax-xmin)*i/500;try{const y=f(x);if(Number.isFinite(y))samples.push({x,y});}catch{}}
  const important=[0,...samples.map(p=>p.y),...steps.map(s=>s.fx)];
  let ymin=Math.min(...important),ymax=Math.max(...important);
  if(!Number.isFinite(ymin)||!Number.isFinite(ymax)){ymin=-1;ymax=1}
  if(ymin===ymax){ymin-=1;ymax+=1}
  const yp=(ymax-ymin)*.12; ymin-=yp;ymax+=yp;
  const X=x=>m.l+(x-xmin)/(xmax-xmin)*(W-m.l-m.r), Y=y=>m.t+(ymax-y)/(ymax-ymin)*(H-m.t-m.b);
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#071526';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#213a55';ctx.lineWidth=1;
  for(let i=0;i<=10;i++){let px=m.l+(W-m.l-m.r)*i/10;ctx.beginPath();ctx.moveTo(px,m.t);ctx.lineTo(px,H-m.b);ctx.stroke()}
  for(let i=0;i<=8;i++){let py=m.t+(H-m.t-m.b)*i/8;ctx.beginPath();ctx.moveTo(m.l,py);ctx.lineTo(W-m.r,py);ctx.stroke()}
  ctx.strokeStyle='#91a8bf';ctx.lineWidth=1.5;
  if(xmin<=0&&xmax>=0){ctx.beginPath();ctx.moveTo(X(0),m.t);ctx.lineTo(X(0),H-m.b);ctx.stroke()}
  if(ymin<=0&&ymax>=0){ctx.beginPath();ctx.moveTo(m.l,Y(0));ctx.lineTo(W-m.r,Y(0));ctx.stroke()}
  ctx.fillStyle='#a9bad0';ctx.font='12px Arial';ctx.textAlign='center';
  for(let i=0;i<=5;i++){let x=xmin+(xmax-xmin)*i/5;ctx.fillText(fmt(x),X(x),H-18)}
  ctx.textAlign='right';for(let i=0;i<=4;i++){let y=ymin+(ymax-ymin)*i/4;ctx.fillText(fmt(y),m.l-8,Y(y)+4)}
  ctx.strokeStyle='#2dd4bf';ctx.lineWidth=3;ctx.beginPath();let started=false;
  for(const p of samples){const px=X(p.x),py=Y(p.y);if(py<m.t-100||py>H-m.b+100){started=false;continue}if(!started){ctx.moveTo(px,py);started=true}else ctx.lineTo(px,py)}ctx.stroke();
  const colors=['#fb7185','#fbbf24','#60a5fa','#c084fc','#34d399','#f97316'];
  steps.forEach((s,i)=>{const c=colors[i%colors.length];ctx.save();ctx.setLineDash([6,5]);ctx.strokeStyle=c;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(X(s.x),Y(s.fx));ctx.lineTo(X(s.next),Y(0));ctx.stroke();ctx.restore();ctx.fillStyle=c;ctx.beginPath();ctx.arc(X(s.x),Y(s.fx),5,0,Math.PI*2);ctx.fill();ctx.font='bold 13px Arial';ctx.textAlign='left';ctx.fillText('x'+i,X(s.x)+7,Y(s.fx)-7);ctx.beginPath();ctx.arc(X(s.next),Y(0),4,0,Math.PI*2);ctx.fill()});
  ctx.fillStyle='#eef6ff';ctx.font='bold 14px Arial';ctx.textAlign='left';ctx.fillText('y = f(x)',m.l+8,m.t+18);
}
$('redrawBtn').addEventListener('click',drawGraph);
window.addEventListener('resize',()=>{if(lastGraphData) drawGraph()});
