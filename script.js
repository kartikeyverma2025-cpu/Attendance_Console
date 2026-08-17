(function(){
  var state = { email: null, subjects: [], criteria: 75, loading: false };

  var loginView = document.getElementById('loginView');
  var appView = document.getElementById('appView');
  var userChipHolder = document.getElementById('userChipHolder');
  var emailInput = document.getElementById('emailInput');
  var loginError = document.getElementById('loginError');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- icon set (minimal inline SVGs) ---------------- */
  var ICON = {
    check: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 13 10 19 20 6"></polyline></svg>',
    x: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="18" y1="6" x2="6" y2="18"></line></svg>',
    pencil: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"></path></svg>',
    trash: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="7" x2="19" y2="7"></line><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"></path></svg>',
    power: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="11"></line><path d="M6 6a8 8 0 1 0 12 0"></path></svg>',
    plus: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="4" x2="12" y2="20"></line><line x1="4" y1="12" x2="20" y2="12"></line></svg>',
    beaker: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"></path><path d="M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"></path></svg>'
  };

  document.getElementById('sampleBtn').innerHTML = ICON.beaker + ' Load Sample';
  document.getElementById('toggleAddBtn').innerHTML = ICON.plus + ' Register Unit';

  /* ---------------- live system clock ---------------- */
  function tickClock(){
    var d = new Date();
    var hh = String(d.getHours()).padStart(2,'0');
    var mm = String(d.getMinutes()).padStart(2,'0');
    var ss = String(d.getSeconds()).padStart(2,'0');
    var el = document.getElementById('sysClock');
    if(el) el.textContent = hh + ':' + mm + ':' + ss;
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------------- boot sequence on login screen ---------------- */
  (function boot(){
    var lines = [
      'INITIALIZING ATTND//OS KERNEL ' ,
      'MOUNTING LOCAL STORAGE VOLUME ',
      'AWAITING OPERATOR CREDENTIALS '
    ];
    var holder = document.getElementById('bootLines');
    if(reduceMotion){
      holder.innerHTML = lines.map(function(l){ return '<div class="ln" style="opacity:1;">'+l+'<span class="ok">[OK]</span></div>'; }).join('');
      return;
    }
    lines.forEach(function(l, i){
      var div = document.createElement('div');
      div.className = 'ln';
      div.style.animationDelay = (i*260) + 'ms';
      div.innerHTML = l;
      holder.appendChild(div);
      setTimeout(function(){
        var ok = document.createElement('span');
        ok.className = 'ok';
        ok.textContent = ' [OK]';
        div.appendChild(ok);
      }, i*260 + 300);
    });
  })();

  /* ---------------- toast notifications ---------------- */
  function showToast(message, kind){
    var holder = document.getElementById('toastHolder');
    var t = document.createElement('div');
    t.className = 'toast' + (kind === 'warn' ? ' warn' : '');
    t.textContent = message;
    holder.appendChild(t);
    setTimeout(function(){ t.remove(); }, 3600);
  }

  /* ---------------- custom confirm modal ---------------- */
  function confirmDialog(message){
    return new Promise(function(resolve){
      var overlay = document.getElementById('modalOverlay');
      document.getElementById('modalMessage').textContent = message;
      overlay.classList.add('open');
      function cleanup(result){
        overlay.classList.remove('open');
        confirmBtn.removeEventListener('click', onConfirm);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onOverlay);
        resolve(result);
      }
      var confirmBtn = document.getElementById('modalConfirm');
      var cancelBtn = document.getElementById('modalCancel');
      function onConfirm(){ cleanup(true); }
      function onCancel(){ cleanup(false); }
      function onOverlay(e){ if(e.target === overlay) cleanup(false); }
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onOverlay);
    });
  }

  /* ---------------- animated number count-up ---------------- */
  function animateNumber(el, to, suffix, duration){
    suffix = suffix || '';
    duration = duration || 500;
    if(reduceMotion){ el.textContent = to + suffix; return; }
    var from = parseFloat(el.getAttribute('data-val') || '0');
    var start = null;
    function step(ts){
      if(!start) start = ts;
      var p = Math.min(1, (ts - start) / duration);
      var eased = 1 - Math.pow(1-p, 3);
      var val = from + (to - from) * eased;
      el.textContent = (Number.isInteger(to) ? Math.round(val) : (Math.round(val*10)/10)) + suffix;
      if(p < 1) requestAnimationFrame(step);
      else el.setAttribute('data-val', to);
    }
    requestAnimationFrame(step);
  }

  /* ---------------- core state helpers ---------------- */
  function isGmail(v){ return /^[^\s@]+@gmail\.com$/i.test((v||'').trim()); }
  function storageKey(email){ return 'attendance:' + email.toLowerCase(); }

  function computeStatus(attended, total, thresholdPct){
    var threshold = thresholdPct / 100;
    if(total === 0){
      return { percent: 0, status: 'new', message: 'No sessions logged yet. Log a class present or absent to bring this unit online.' };
    }
    var percent = attended / total;
    if(percent >= threshold){
      var canSkip = Math.floor(attended / threshold - total);
      if(canSkip <= 0){
        return { percent: percent, status: 'exact', message: 'Holding exactly on the threshold. Logging the next session present keeps it stable.' };
      }
      return { percent: percent, status: 'safe', canSkip: canSkip,
        message: 'Margin of ' + canSkip + ' session' + (canSkip===1?'':'s') + ' — can be logged absent and still hold ' + thresholdPct + '%.' };
    }else{
      var denom = (1 - threshold);
      var need = Math.ceil((threshold*total - attended) / denom);
      need = Math.max(need, 1);
      return { percent: percent, status: 'danger', need: need,
        message: 'Deficit detected — log the next ' + need + ' session' + (need===1?'':'s') + ' present, none missed, to clear ' + thresholdPct + '%.' };
    }
  }

  function pct(n){ return Math.round(n*1000)/10; }

  function renderUserChip(){
    var led = document.getElementById('statusLed');
    if(!state.email){
      userChipHolder.innerHTML='';
      if(led) led.classList.remove('on');
      return;
    }
    if(led) led.classList.add('on');
    userChipHolder.innerHTML =
      '<div class="user-chip"><span class="who">' + state.email + '</span><button id="signOutBtn">' + ICON.power + ' Disconnect</button></div>';
    document.getElementById('signOutBtn').addEventListener('click', signOut);
  }

  function signOut(){
    state.email = null;
    state.subjects = [];
    loginView.hidden = false;
    appView.hidden = true;
    emailInput.value = '';
    renderUserChip();
  }

  function persist(){
    if(!state.email) return;
    try{
      localStorage.setItem(storageKey(state.email), JSON.stringify({ subjects: state.subjects, criteria: state.criteria }));
    }catch(err){
      console.error('Could not save register', err);
      showToast('WRITE FAILED — storage blocked or full. Changes will not persist.', 'warn');
    }
  }

  function loadForUser(email){
    try{
      var raw = localStorage.getItem(storageKey(email));
      if(raw){
        var parsed = JSON.parse(raw);
        state.subjects = parsed.subjects || [];
        state.criteria = parsed.criteria || 75;
      }else{
        state.subjects = [];
        state.criteria = 75;
      }
    }catch(err){
      console.error('Could not load saved register', err);
      state.subjects = [];
      state.criteria = 75;
    }
  }

  document.getElementById('loginBtn').addEventListener('click', function(){
    var val = emailInput.value;
    if(!isGmail(val)){
      loginError.textContent = 'invalid operator id — use name@gmail.com';
      return;
    }
    loginError.textContent = '';
    state.email = val.trim().toLowerCase();
    try{ localStorage.setItem('attendance:lastEmail', state.email); }catch(err){}
    loginView.hidden = true;
    appView.hidden = false;
    loadForUser(state.email);
    document.getElementById('criteriaInput').value = state.criteria;
    renderUserChip();
    renderAll();
    showToast('Console online — welcome back, operator.');
  });

  (function prefillLastEmail(){
    try{
      var last = localStorage.getItem('attendance:lastEmail');
      if(last) emailInput.value = last;
    }catch(err){}
  })();

  emailInput.addEventListener('keydown', function(e){
    if(e.key === 'Enter') document.getElementById('loginBtn').click();
  });

  var criteriaInput = document.getElementById('criteriaInput');
  criteriaInput.addEventListener('change', function(){
    var v = parseInt(criteriaInput.value, 10);
    if(isNaN(v) || v < 1) v = 1;
    if(v > 100) v = 100;
    state.criteria = v;
    criteriaInput.value = v;
    persist();
    renderAll();
  });

  var addForm = document.getElementById('addForm');
  document.getElementById('toggleAddBtn').addEventListener('click', function(){
    addForm.classList.toggle('open');
    if(addForm.classList.contains('open')) document.getElementById('newSubjectName').focus();
  });
  document.getElementById('cancelAddBtn').addEventListener('click', function(){
    addForm.classList.remove('open');
    document.getElementById('addError').textContent = '';
    document.getElementById('newSubjectName').value = '';
    document.getElementById('newSubjectAttended').value = 0;
    document.getElementById('newSubjectTotal').value = 0;
  });

  document.getElementById('saveSubjectBtn').addEventListener('click', function(){
    var name = document.getElementById('newSubjectName').value.trim();
    var attended = parseInt(document.getElementById('newSubjectAttended').value, 10) || 0;
    var total = parseInt(document.getElementById('newSubjectTotal').value, 10) || 0;
    var err = document.getElementById('addError');
    if(!name){ err.textContent = 'unit name required'; return; }
    if(attended < 0 || total < 0){ err.textContent = 'values cannot be negative'; return; }
    if(attended > total){ err.textContent = 'sessions attended cannot exceed sessions held'; return; }
    err.textContent = '';
    state.subjects.push({ id: 'sub_' + Date.now() + '_' + Math.floor(Math.random()*1000), name: name, attended: attended, total: total });
    document.getElementById('cancelAddBtn').click();
    persist();
    renderAll();
    showToast('Unit registered: ' + name);
  });

  function seedSamples(){
    state.subjects = [
      { id:'s1', name:'Data Structures', attended: 27, total: 32 },
      { id:'s2', name:'Digital Electronics', attended: 18, total: 30 },
      { id:'s3', name:'Engineering Mathematics', attended: 22, total: 24 },
      { id:'s4', name:'Communication Skills', attended: 9, total: 14 }
    ];
    persist();
    renderAll();
    showToast('Diagnostic sample data loaded.');
  }
  document.getElementById('sampleBtn').addEventListener('click', seedSamples);
  document.getElementById('emptySampleBtn').addEventListener('click', seedSamples);

  function markPresent(id){
    var s = state.subjects.find(function(x){ return x.id === id; });
    if(!s) return;
    s.attended += 1; s.total += 1;
    persist(); renderAll();
  }
  function markAbsent(id){
    var s = state.subjects.find(function(x){ return x.id === id; });
    if(!s) return;
    s.total += 1;
    persist(); renderAll();
  }
  async function deleteSubject(id){
    var s = state.subjects.find(function(x){ return x.id === id; });
    if(!s) return;
    var ok = await confirmDialog('Decommission "' + s.name + '"? This removes its logged history.');
    if(!ok) return;
    state.subjects = state.subjects.filter(function(x){ return x.id !== id; });
    persist(); renderAll();
    showToast('Unit decommissioned.', 'warn');
  }
  function openEdit(id){
    var row = document.querySelector('[data-editrow="'+id+'"]');
    if(row) row.hidden = !row.hidden;
  }
  function saveEdit(id){
    var a = document.getElementById('edA_'+id);
    var t = document.getElementById('edT_'+id);
    var av = parseInt(a.value,10), tv = parseInt(t.value,10);
    if(isNaN(av) || isNaN(tv) || av < 0 || tv < 0 || av > tv) return;
    var s = state.subjects.find(function(x){ return x.id === id; });
    s.attended = av; s.total = tv;
    persist(); renderAll();
    showToast('Totals updated.');
  }

  function renderDial(percentValue){
    var ring = document.getElementById('tickRing');
    var N = 30, cx = 100, cy = 100, r = 84, tickH = 13, tickW = 4;
    var clamped = Math.max(0, Math.min(1, percentValue));
    var lit = Math.round(clamped * N);
    var html = '';
    for(var i=0;i<N;i++){
      var angle = (i * (360/N)) - 90;
      var cls = 'tick';
      if(i < lit){
        cls += ' ' + (clamped >= state.criteria/100 ? 'lit-safe' : 'lit-danger');
      }
      html += '<g transform="rotate('+angle.toFixed(2)+' '+cx+' '+cy+')">' +
        '<rect class="'+cls+'" x="'+(cx-tickW/2)+'" y="'+(cy-r-tickH/2)+'" width="'+tickW+'" height="'+tickH+'" rx="1"></rect>' +
      '</g>';
    }
    ring.innerHTML = html;
    animateNumber(document.getElementById('dialPct'), pct(clamped), '%', 550);
  }

  function renderAll(){
    var list = document.getElementById('subjectList');
    var empty = document.getElementById('emptyState');
    var count = document.getElementById('subjectCount');
    count.textContent = state.subjects.length ? '(' + state.subjects.length + ')' : '';

    if(state.subjects.length === 0){
      list.innerHTML = '';
      empty.hidden = false;
    }else{
      empty.hidden = true;
      list.innerHTML = state.subjects.map(function(s, idx){
        var st = computeStatus(s.attended, s.total, state.criteria);
        var badgeText = st.status === 'danger' ? 'Critical' : st.status === 'safe' ? 'Operational' : st.status === 'exact' ? 'Marginal' : 'Uninitialized';
        var unitId = 'U-' + String(idx+1).padStart(3,'0');
        var segCount = 20;
        var segOn = Math.min(segCount, Math.round(pct(st.percent)/100 * segCount));
        var segClass = st.status === 'danger' ? 'on-danger' : st.status === 'exact' ? 'on-exact' : st.status === 'safe' ? 'on-safe' : '';
        var segsHtml = '';
        for(var i=0;i<segCount;i++){
          segsHtml += '<div class="bar-seg' + (i<segOn ? ' '+segClass : '') + '"></div>';
        }
        return (
        '<div class="subject hud-frame '+st.status+'" style="--i:'+idx+'">' +
          '<div class="spine"></div>' +
          '<div class="subject-body">' +
            '<div class="subject-top">' +
              '<span><span class="unit-id">'+unitId+'</span><span class="subject-name">'+escapeHtml(s.name)+'</span></span>' +
              '<span class="subject-pct">'+pct(st.percent)+'%</span>' +
            '</div>' +
            '<div class="subject-meta">'+s.attended+' / '+s.total+' sessions logged present</div>' +
            '<div class="bar-track">'+segsHtml+'</div>' +
            '<span class="badge">'+badgeText+'</span>' +
            '<p class="subject-note">'+st.message+'</p>' +
            '<div class="edit-row" data-editrow="'+s.id+'" hidden style="margin-top:8px;">' +
              '<input type="number" min="0" id="edA_'+s.id+'" value="'+s.attended+'"> /' +
              '<input type="number" min="0" id="edT_'+s.id+'" value="'+s.total+'">' +
              '<button class="mini-btn" data-action="save-edit" data-id="'+s.id+'" style="flex:none;padding:6px 10px;">Save</button>' +
            '</div>' +
          '</div>' +
          '<div class="subject-actions">' +
            '<div class="row2">' +
              '<button class="mini-btn present" data-action="present" data-id="'+s.id+'">'+ICON.check+' Present</button>' +
              '<button class="mini-btn absent" data-action="absent" data-id="'+s.id+'">'+ICON.x+' Absent</button>' +
            '</div>' +
            '<button class="mini-link" data-action="edit" data-id="'+s.id+'">'+ICON.pencil+' Edit totals</button>' +
            '<button class="mini-link" data-action="delete" data-id="'+s.id+'">'+ICON.trash+' Decommission</button>' +
          '</div>' +
        '</div>');
      }).join('');
    }

    var totalAttended = state.subjects.reduce(function(a,s){return a+s.attended;},0);
    var totalHeld = state.subjects.reduce(function(a,s){return a+s.total;},0);
    var overall = computeStatus(totalAttended, totalHeld, state.criteria);
    renderDial(overall.percent);

    var below = state.subjects.filter(function(s){ return s.total>0 && (s.attended/s.total) < state.criteria/100; }).length;
    var statsHtml =
      '<div class="stat"><div class="num" id="statUnits">0</div><div class="lbl">Units tracked</div></div>' +
      '<div class="stat"><div class="num" id="statSessions">0/0</div><div class="lbl">Sessions logged</div></div>' +
      '<div class="stat"><div class="num" id="statCritical" style="color:'+(below>0?'#FF6161':'#5EEAD4')+'">0</div><div class="lbl">Units critical</div></div>';
    document.getElementById('summaryStats').innerHTML = statsHtml;
    animateNumber(document.getElementById('statUnits'), state.subjects.length, '', 450);
    document.getElementById('statSessions').textContent = totalAttended + '/' + totalHeld;
    animateNumber(document.getElementById('statCritical'), below, '', 450);

    document.getElementById('summaryNote').innerHTML = '<strong>FLEET STATUS //</strong> ' + overall.message;
  }

  document.getElementById('subjectList').addEventListener('click', function(e){
    var btn = e.target.closest('[data-action]');
    if(!btn) return;
    var id = btn.getAttribute('data-id');
    var action = btn.getAttribute('data-action');
    if(action === 'present') markPresent(id);
    else if(action === 'absent') markAbsent(id);
    else if(action === 'delete') deleteSubject(id);
    else if(action === 'edit') openEdit(id);
    else if(action === 'save-edit') saveEdit(id);
  });

  function escapeHtml(str){
    return str.replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c];
    });
  }
})();