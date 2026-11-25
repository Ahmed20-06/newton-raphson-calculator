const $ = id => document.getElementById(id);
const form = $('solverForm');

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
    $('path').innerHTML = path.map((v,i)=>`${i?'<span class="arrow">→</span>':''}<span class="node">x<sub>${i}</sub> = ${fmt(v)}</span>`).join('');
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
