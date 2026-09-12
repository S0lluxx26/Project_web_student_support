/* Teaching examples only: no OCR/model runtime, no conversation persistence. */
(function () {
  'use strict';
  var lang, cases, filter='all', revision=0;
  try { lang=localStorage.getItem('shsa.lang'); } catch (_) {}
  if (lang!=='ko'&&lang!=='en') lang=/^ko/i.test(navigator.language)?'ko':'en';
  var root=document.getElementById('learning-cases'), status=document.getElementById('sample-status');
  var labels={ko:{no_known_signals:'알려진 위험 신호 없음',needs_review:'확인 필요',insufficient_information:'정보 부족',strong_warning_signals:'뚜렷한 위험 신호'},en:{no_known_signals:'No known signals',needs_review:'Needs review',insufficient_information:'Insufficient information',strong_warning_signals:'Strong warning signals'}};
  function node(tag,text,className){var n=document.createElement(tag);if(text)n.textContent=text;if(className)n.className=className;return n;}
  function render(){
    document.documentElement.lang=lang;
    document.getElementById('help-language').textContent=lang==='ko'?'English':'한국어';
    document.title=lang==='ko'?'판단 도움말 · 연습 | 학생 주거 안전 도우미':'Safety help & practice | Student Housing Safety Assistant';
    if(!cases)return;
    root.replaceChildren();
    var selected=cases.filter(function(c){return filter==='all'||c.category===filter;});
    selected.forEach(function(c){
      var card=node('article',null,'sample-card');card.dataset.case=c.id;
      card.append(node('h3',c.title[lang]),node('p',(lang==='ko'?'검토된 원문의 예상 결과: ':'Expected after text review: ')+labels[lang][c.expect],'key-point'),node('p',c.why[lang]));
      var link=node('a');link.href=c.image;link.target='_blank';link.rel='noopener';
      var img=node('img');img.src=c.image;img.alt=c.title[lang]+(lang==='ko'?' · 가상 대화':' · fictional conversation');img.loading='lazy';img.className='chat-image';link.append(img);card.append(link);
      var download=node('a',lang==='ko'?'이미지 내려받기':'Download screenshot','button secondary');download.href=c.image;download.download=c.id+'.png';card.append(download);
      var detail=node('details');detail.append(node('summary',lang==='ko'?'원문과 비교하기':'Compare with the transcript'),node('pre',c.text));card.append(detail);root.append(card);
    });
    status.textContent=selected.length+(lang==='ko'?'개의 가상 예시':' fictional examples');
  }
  async function load(){
    var rev=++revision;
    var controller=new AbortController();
    var timeout=setTimeout(function(){controller.abort();},12000);
    document.getElementById('samples-retry').hidden=true;
    status.textContent=lang==='ko'?'예시를 불러오는 중입니다.':'Loading examples.';
    try{
      var res=await fetch('assets/examples/cases.json',{signal:controller.signal});if(!res.ok)throw Error('examples');
      var data=await res.json();if(rev!==revision)return;
      if(!data.fictional||!Array.isArray(data.cases))throw Error('schema');
      cases=data.cases;render();
    }catch(_){if(rev!==revision)return;status.textContent=lang==='ko'?'예시를 불러오지 못했습니다. 위의 도움말은 계속 읽을 수 있습니다.':'Examples could not load. The guidance above is still available.';document.getElementById('samples-retry').hidden=false;}
    finally{clearTimeout(timeout);}
  }
  document.getElementById('help-language').addEventListener('click',function(){lang=lang==='ko'?'en':'ko';try{localStorage.setItem('shsa.lang',lang);}catch(_){}render();});
  document.querySelectorAll('[data-filter]').forEach(function(button){button.addEventListener('click',function(){filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(function(b){b.setAttribute('aria-pressed',String(b===button));});render();});});
  document.getElementById('samples-retry').addEventListener('click',load);
  render();load();
})();
