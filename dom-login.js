/* DOM Login — ingreso "líquido" (ref. video "Login Animation V2").
   Un botón píldora que al tocarlo se divide como un líquido en los campos de ingreso,
   y al enviar se vuelve a unir y confirma con una tilde. Sin dependencias.
   Desarrollado por The DOM Studio Web · thedomstudioweb.github.io

   Uso:
     DomLogin.mount(document.getElementById('login'), {
       campos: [ { nombre:'email', etiqueta:'Correo', tipo:'email', autocomplete:'username' },
                 { nombre:'clave', etiqueta:'Contraseña', tipo:'password', autocomplete:'current-password' } ],
       boton: 'Ingresar', listo: 'Ingresaste',
       enviar: (valores) => Promise   // se resuelve si entra; se rechaza con Error('mensaje') si no
       hecho:  (resultado) => {}      // se llama después de la tilde
     });
   Colores: se toman de variables CSS del contenedor (ver DEFECTOS más abajo), así cada marca usa los suyos. */
(function () {
  var CSS = [
    '.dl{--dl-pill-a:#f4f6f8;--dl-pill-b:#cfd5dc;--dl-pill-tx:#15181d;--dl-field:#1b1f25;--dl-field-bd:rgba(255,255,255,.09);--dl-tx:#eef1f4;--dl-mut:#8b939e;--dl-accent:#3fd39a;--dl-ok:#3fd39a;--dl-bad:#ff6b61;',
    '  position:relative;width:100%;max-width:380px;margin:0 auto;font-family:inherit}',
    '.dl-stage{position:relative;height:136px}',
    '.dl-goo{position:absolute;inset:0;filter:url(#dl-goo-f)}',
    '.dl-blob{position:absolute;left:14%;width:72%;top:42px;height:52px;border-radius:26px;background:linear-gradient(180deg,var(--dl-pill-a),var(--dl-pill-b));',
    '  transition:top .5s cubic-bezier(.55,0,.2,1),height .5s cubic-bezier(.55,0,.2,1),left .5s cubic-bezier(.55,0,.2,1),width .5s cubic-bezier(.55,0,.2,1),border-radius .5s,background .35s}',
    '.dl-drop{position:absolute;left:50%;top:64px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:var(--dl-pill-b);opacity:0;transform:scale(0)}',
    /* estados de la píldora */
    '.dl.dl-crece .dl-blob{top:36px;height:64px;border-radius:30px}',
    '.dl.dl-abre .dl-a{top:0;height:60px;left:0;width:100%;border-radius:16px}',
    '.dl.dl-abre .dl-b{top:76px;height:60px;left:0;width:100%;border-radius:16px}',
    '.dl.dl-abre .dl-drop{animation:dl-drop .7s cubic-bezier(.3,.6,.4,1) forwards}',
    '.dl.dl-abre .dl-drop:nth-of-type(2){animation-delay:.05s}.dl.dl-abre .dl-drop:nth-of-type(3){animation-delay:.1s}',
    '.dl.dl-oscuro .dl-blob{background:var(--dl-field)}',
    '.dl.dl-cierra .dl-blob{transition-duration:.75s,.75s,.75s,.75s,.6s,.35s}',
    '.dl-seam{position:absolute;left:18%;right:18%;top:67px;height:2px;border-radius:2px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.95),transparent);opacity:0;transition:opacity .15s}',
    '.dl.dl-crece .dl-seam{opacity:1}.dl.dl-abre .dl-seam{opacity:0}',
    /* texto del botón */
    '.dl .dl-btn{margin:0;padding:0;min-height:0;box-shadow:none;letter-spacing:normal;position:absolute;left:14%;width:72%;top:42px;height:52px;border:0;border-radius:26px;background:transparent;color:var(--dl-pill-tx);font-family:inherit;font-size:15px;font-weight:700;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;z-index:2;transition:opacity .2s,color .3s}',
    '.dl-btn:focus-visible{outline:2px solid var(--dl-accent);outline-offset:4px}',
    '.dl.dl-crece .dl-btn,.dl.dl-abre .dl-btn{opacity:0;pointer-events:none}',
    '.dl-pillglow{position:absolute;left:14%;width:72%;top:42px;height:52px;border-radius:26px;box-shadow:0 14px 34px rgba(0,0,0,.35);pointer-events:none;transition:box-shadow .5s,opacity .2s}',
    '.dl.dl-abre .dl-pillglow{opacity:0}',
    '.dl.dl-ok .dl-pillglow{box-shadow:0 0 0 1px color-mix(in srgb,var(--dl-ok) 55%,transparent),0 0 34px color-mix(in srgb,var(--dl-ok) 45%,transparent)}',
    '.dl.dl-bad .dl-pillglow{box-shadow:0 0 0 1px color-mix(in srgb,var(--dl-bad) 60%,transparent),0 0 30px color-mix(in srgb,var(--dl-bad) 40%,transparent)}',
    '.dl.dl-bad .dl-stage{animation:dl-shake .42s}',
    '.dl-btn svg{width:18px;height:18px;flex:none}',
    '.dl-btn .tk{fill:none;stroke:var(--dl-ok);stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;animation:dl-draw .4s .1s ease-out forwards}',
    '.dl-btn .sp{width:16px;height:16px;border-radius:50%;border:2.5px solid rgba(0,0,0,.18);border-top-color:var(--dl-pill-tx);animation:dl-spin .7s linear infinite}',
    /* campos reales */
    '.dl-f{position:absolute;left:0;width:100%;height:60px;opacity:0;pointer-events:none;transition:opacity .25s}',
    '.dl-f1{top:0}.dl-f2{top:76px}',
    '.dl.dl-campos .dl-f{opacity:1;pointer-events:auto}',
    '.dl.dl-campos .dl-goo{opacity:0;transition:opacity .25s .15s}',
    '.dl .dl-f label{margin:0;padding:0;display:block;line-height:1.2;letter-spacing:normal;text-transform:none;background:none;border:0;width:auto;z-index:1;position:absolute;left:16px;top:9px;font-size:11px;font-weight:600;color:var(--dl-mut);pointer-events:none;transition:color .2s}',
    '.dl .dl-f input{margin:0;display:block;min-height:0;line-height:1.2;letter-spacing:normal;text-transform:none;width:100%;height:100%;box-sizing:border-box;padding:22px 52px 6px 16px;border-radius:16px;border:1px solid var(--dl-field-bd);background:var(--dl-field);color:var(--dl-tx);font-family:inherit;font-size:16px;font-weight:500;outline:0;transition:border-color .2s,box-shadow .2s}',
    '.dl .dl-f input:focus{border-color:color-mix(in srgb,var(--dl-accent) 75%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dl-accent) 18%,transparent),0 0 22px color-mix(in srgb,var(--dl-accent) 14%,transparent)}',
    '.dl-f input:focus + label,.dl-f:focus-within label{color:var(--dl-accent)}',
    '.dl .dl-go{padding:0;min-height:0;box-shadow:none;position:absolute;right:8px;top:50%;width:40px;height:40px;margin-top:-20px;border:0;border-radius:12px;background:var(--dl-accent);color:#0c0f12;display:grid;place-items:center;cursor:pointer}',
    '.dl-go svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round}',
    '.dl .dl-f select{margin:0;display:block;min-height:0;width:100%;height:100%;box-sizing:border-box;padding:22px 44px 6px 14px;border-radius:16px;border:1px solid var(--dl-field-bd);background:var(--dl-field);color:var(--dl-tx);font-family:inherit;font-size:16px;font-weight:600;outline:0;-webkit-appearance:none;appearance:none;cursor:pointer;',
    '  background-image:linear-gradient(45deg,transparent 50%,var(--dl-mut) 50%),linear-gradient(135deg,var(--dl-mut) 50%,transparent 50%);background-position:calc(100% - 22px) 55%,calc(100% - 16px) 55%;background-size:6px 6px;background-repeat:no-repeat}',
    '.dl .dl-f select:focus{border-color:color-mix(in srgb,var(--dl-accent) 75%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--dl-accent) 18%,transparent)}',
    '.dl-f1 select ~ .dl-go{display:none}',
    '.dl-slot{position:absolute;left:0;right:0;top:76px;opacity:0;pointer-events:none;transition:opacity .25s}',
    '.dl.dl-campos .dl-slot{opacity:1;pointer-events:auto}',
    '.dl.dl-con-slot.abre .dl-b{top:96px;height:60px}',
    '.dl-stage{transition:height .35s cubic-bezier(.3,.7,.2,1)}',
    '.dl-msg{min-height:20px;margin:8px 0 0;text-align:center;font-size:13.5px;font-weight:600;color:var(--dl-bad)}',
    '.dl .dl-ver{min-height:0;width:auto;box-shadow:none;letter-spacing:normal;text-transform:none;position:absolute;right:56px;top:50%;margin-top:-14px;height:28px;padding:0 6px;border:0;background:none;color:var(--dl-mut);font-family:inherit;font-size:11.5px;font-weight:600;cursor:pointer}',
    '@keyframes dl-drop{0%{opacity:1;transform:translate(var(--dx,0),0) scale(1)}60%{opacity:1}100%{opacity:0;transform:translate(var(--dx,0),var(--dy,6px)) scale(0)}}',
    '@keyframes dl-draw{to{stroke-dashoffset:0}}@keyframes dl-spin{to{transform:rotate(360deg)}}',
    '@keyframes dl-shake{20%,60%{transform:translateX(-9px)}40%,80%{transform:translateX(9px)}}',
    '@media (prefers-reduced-motion:reduce){.dl-blob,.dl-f,.dl-btn,.dl-pillglow{transition:none}.dl.dl-abre .dl-drop,.dl.dl-bad .dl-stage{animation:none}}'
  ].join('\n');
  var SVG_GOO = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="dl-goo-f"><feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b"/><feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" result="g"/><feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></svg>';
  var FLECHA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg>';
  var TILDE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="tk" d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function prep() {
    if (document.getElementById('dl-css')) return;
    var s = document.createElement('style'); s.id = 'dl-css'; s.textContent = CSS; document.head.appendChild(s);
    var d = document.createElement('div'); d.innerHTML = SVG_GOO; document.body.appendChild(d.firstChild);
  }
  var RM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, RM ? 0 : ms); }); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function mount(host, o) {
    prep(); o = o || {};
    var campos = (o.campos || [{ nombre: 'email', etiqueta: 'Correo', tipo: 'email', autocomplete: 'username' }, { nombre: 'clave', etiqueta: 'Contraseña', tipo: 'password', autocomplete: 'current-password' }]).slice(0, 2);
    var uid = 'dl' + Math.random().toString(36).slice(2, 7), estado = 'pildora', ocupado = false;
    host.innerHTML =
      '<form class="dl" novalidate autocomplete="on">' +
        '<div class="dl-stage">' +
          '<div class="dl-pillglow"></div>' +
          '<div class="dl-goo" aria-hidden="true"><div class="dl-blob dl-a"></div><div class="dl-blob dl-b"></div>' +
            '<i class="dl-drop" style="--dx:-26px;--dy:4px"></i><i class="dl-drop" style="--dx:4px;--dy:-3px"></i><i class="dl-drop" style="--dx:30px;--dy:5px"></i></div>' +
          '<div class="dl-seam" aria-hidden="true"></div>' +
          campos.map(function (c, i) {
            var ult = i === campos.length - 1;
            if (c.tipo === 'select') return '<div class="dl-f dl-f' + (i + 1) + '"><select id="' + uid + c.nombre + '" name="' + esc(c.nombre) + '" tabindex="-1"' + (c.autocomplete ? ' autocomplete="' + c.autocomplete + '"' : '') + '>' +
              '<option value="">' + esc(c.vacio || 'Elegí…') + '</option>' + (c.opciones || []).map(function (op) { var v = typeof op === 'string' ? op : op.valor, t = typeof op === 'string' ? op : op.texto; return '<option value="' + esc(v) + '"' + (c.valor === v ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') +
              '</select><label for="' + uid + c.nombre + '">' + esc(c.etiqueta || c.nombre) + '</label>' + (ult ? '<button type="submit" class="dl-go" tabindex="-1" aria-label="' + esc(o.boton || 'Ingresar') + '">' + FLECHA + '</button>' : '') + '</div>';
            if (c.tipo === 'slot') return '<div class="dl-slot"></div>';
            return '<div class="dl-f dl-f' + (i + 1) + '"><input id="' + uid + c.nombre + '" name="' + esc(c.nombre) + '" type="' + (c.tipo || 'text') + '"' +
              (c.autocomplete ? ' autocomplete="' + c.autocomplete + '"' : '') + (c.inputmode ? ' inputmode="' + c.inputmode + '"' : '') +
              (c.valor ? ' value="' + esc(c.valor) + '"' : '') + ' tabindex="-1" placeholder=" " ' + (c.tipo === 'email' ? 'autocapitalize="off" spellcheck="false"' : '') + '>' +
              '<label for="' + uid + c.nombre + '">' + esc(c.etiqueta || c.nombre) + '</label>' +
              (c.tipo === 'password' ? '<button type="button" class="dl-ver" tabindex="-1" aria-label="Mostrar contraseña">Ver</button>' : '') +
              (ult ? '<button type="submit" class="dl-go" tabindex="-1" aria-label="' + esc(o.boton || 'Ingresar') + '">' + FLECHA + '</button>' : '') + '</div>';
          }).join('') +
          '<button type="button" class="dl-btn" aria-expanded="false">' + esc(o.boton || 'Ingresar') + '</button>' +
        '</div>' +
        '<p class="dl-msg" role="status" aria-live="polite"></p>' +
      '</form>';
    var root = host.firstChild, btn = root.querySelector('.dl-btn'), msg = root.querySelector('.dl-msg');
    var inputs = Array.prototype.slice.call(root.querySelectorAll('.dl-f input,.dl-f select')), extras = root.querySelectorAll('.dl-f button');
    var slot = root.querySelector('.dl-slot'), stage = root.querySelector('.dl-stage');
    if (slot) { root.classList.add('dl-con-slot'); if (o.slot) o.slot(slot); }
    function tabs(on) { inputs.concat(Array.prototype.slice.call(extras)).forEach(function (el) { el.tabIndex = on ? 0 : -1; }); }
    function cls(add, rem) { (rem || []).forEach(function (c) { root.classList.remove(c); }); (add || []).forEach(function (c) { root.classList.add(c); }); }

    function abrir() {
      if (estado !== 'pildora' || ocupado) return Promise.resolve();
      ocupado = true; btn.setAttribute('aria-expanded', 'true'); cls([], ['dl-ok', 'dl-bad']);
      cls(['dl-crece']);
      return wait(170).then(function () { cls(['dl-abre'], ['dl-crece']); return wait(430); })
        .then(function () { cls(['dl-oscuro', 'dl-campos']); return wait(60); })
        .then(function () {
          tabs(true); estado = 'campos'; ocupado = false;
          if (slot) stage.style.height = (76 + slot.offsetHeight) + 'px';
          var vacio = inputs.filter(function (i) { return !i.value; })[0] || inputs[inputs.length - 1];
          vacio.focus();
        });
    }
    function cerrar(texto, conSpin) {
      ocupado = true; tabs(false); cls(['dl-cierra'], ['dl-campos']); stage.style.height = '';
      btn.innerHTML = (conSpin ? '<span class="sp" aria-hidden="true"></span>' : '') + esc(texto);
      return wait(200).then(function () { cls([], ['dl-oscuro']); return wait(220); })
        .then(function () { cls([], ['dl-abre']); return wait(800); })
        .then(function () { cls([], ['dl-cierra']); estado = 'pildora'; ocupado = false; });
    }
    function enviar(e) {
      if (e) e.preventDefault();
      if (estado !== 'campos' || ocupado) return;
      var v = {}; inputs.forEach(function (i) { v[i.name] = i.value.trim(); });
      var falta = inputs.filter(function (i) { return !i.value.trim(); })[0];
      if (falta) { msg.textContent = 'Completá ' + (falta.nextElementSibling ? falta.nextElementSibling.textContent.toLowerCase() : 'los datos') + '.'; falta.focus(); return; }
      msg.textContent = '';
      var p;
      try { p = Promise.resolve(o.enviar ? o.enviar(v) : true); } catch (er) { p = Promise.reject(er); }
      var res = p.then(function (r) { return { ok: true, r: r }; }, function (er) { return { ok: false, e: er }; });
      Promise.all([res, cerrar(o.enviando || 'Ingresando…', true)]).then(function (x) {
        var r = x[0];
        if (r.ok) {
          cls(['dl-ok']); btn.innerHTML = TILDE + esc(o.listo || 'Ingresaste'); btn.disabled = true;
          setTimeout(function () { if (o.hecho) o.hecho(r.r); }, RM ? 200 : 1200);
        } else {
          cls(['dl-bad']); btn.textContent = o.boton || 'Ingresar';
          msg.textContent = (r.e && r.e.message) || 'No se pudo ingresar.';
          setTimeout(function () { cls([], ['dl-bad']); abrir(); }, RM ? 100 : 650);
        }
      });
    }
    btn.addEventListener('click', abrir);
    root.addEventListener('submit', enviar);
    inputs.forEach(function (inp, i) {
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && i < inputs.length - 1) { e.preventDefault(); inputs[i + 1].focus(); }
        else if (e.key === 'Enter' && slot) { e.preventDefault(); var f = slot.querySelector('input'); if (f) f.focus(); }
      });
      inp.addEventListener('input', function () { msg.textContent = ''; });
      if (inp.tagName === 'SELECT') inp.addEventListener('change', function () { if (inputs[i + 1]) inputs[i + 1].focus(); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('.dl-ver'), function (b) {
      b.addEventListener('click', function () { var i = b.parentNode.querySelector('input'); var ver = i.type === 'password'; i.type = ver ? 'text' : 'password'; b.textContent = ver ? 'Ocultar' : 'Ver'; b.setAttribute('aria-label', ver ? 'Ocultar contraseña' : 'Mostrar contraseña'); i.focus(); });
    });
    if (o.abierto) abrir();
    return {
      abrir: abrir,
      error: function (t) { msg.textContent = t || ''; },
      valores: function () { var v = {}; inputs.forEach(function (i) { v[i.name] = i.value; }); return v; },
      reiniciar: function () { btn.disabled = false; btn.textContent = o.boton || 'Ingresar'; cls([], ['dl-ok', 'dl-bad', 'dl-campos', 'dl-oscuro', 'dl-abre', 'dl-crece']); estado = 'pildora'; tabs(false); }
    };
  }
  window.DomLogin = { mount: mount };
})();
