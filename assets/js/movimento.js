/* movimento.js — movimento DESTE site (specs/design.md §10). Só transform e opacity; rolagem por window.aoRolar
   (main.js), nunca addEventListener('scroll'); medidas fora do handler (carga e resize). main.js e base.css não se editam.
   0. ?heroi=1|2|3 no index: troca foto, alt e H1 do herói (escolha do gerente de revisão; o H1 nomeia a foto).
   1. Assinatura 1 (herói): foto 1.06 → 1, moldura de fio se desenha, texto escalonado (classe .pronto no <html>);
      ao rolar, a foto desloca ≤ 6% (só computador).
   2. Assinatura 2 (Como é a sua sessão): passos entram um a um (120 ms) e, ≥ 900px, a foto troca por crossfade
      conforme o passo mais perto do meio da tela.
   3. FAQ: um item aberto por vez.
   4. Separador "·": some quando quebra a linha (mede na carga, nas fontes e no resize; nunca na rolagem). */
(function () {
  'use strict';
  var raiz = document.documentElement;
  var reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var computador = window.matchMedia('(min-width: 900px)');

  /* 0. Opções de herói (antes da entrada, para a foto escolhida entrar animada) */
  var heroi = document.querySelector('[data-heroi-opcoes]');
  var escolha = new URLSearchParams(location.search).get('heroi');
  if (heroi && escolha && escolha !== '1') {
    try {
      var op = JSON.parse(heroi.getAttribute('data-heroi-opcoes'))[escolha];
      if (op) {
        var fontes = heroi.querySelectorAll('.heroi__midia source');
        fontes[0].srcset = op.cel; fontes[1].srcset = op.pc;
        var img = heroi.querySelector('.heroi__midia img');
        img.src = op.src; img.alt = op.alt;
        var h1 = heroi.querySelector('[data-heroi-h1]');
        if (h1) h1.innerHTML = op.h1;
        heroi.setAttribute('data-opcao', escolha);
      }
    } catch (e) { /* opção inválida: fica a 1 */ }
  }

  /* 1. Entrada das primeiras telas: dois quadros depois do primeiro desenho, para a transição partir do estado inicial */
  if (reduzir) raiz.classList.add('pronto');
  else requestAnimationFrame(function () { requestAnimationFrame(function () { raiz.classList.add('pronto'); }); });

  /* 1b. Deslocamento leve da foto do herói ao rolar (só computador, ≤ 6% da altura) */
  var midiaHeroi = document.querySelector('.heroi .heroi__midia');
  if (midiaHeroi && !reduzir) {
    var altura = 0, fim = 1;
    var medirHeroi = function () {
      altura = midiaHeroi.offsetHeight;
      var s = midiaHeroi.closest('section');
      fim = s ? s.offsetTop + s.offsetHeight : window.innerHeight;
      if (!computador.matches) midiaHeroi.style.transform = '';
    };
    medirHeroi();
    window.addEventListener('resize', medirHeroi);
    window.aoRolar(function (d) {
      if (!computador.matches || d.scroll > fim) return;
      var p = Math.min(1, d.scroll / fim);
      midiaHeroi.style.transform = 'translate3d(0,' + (p * altura * 0.06).toFixed(1) + 'px,0)';
    });
  }

  /* 2. Assinatura 2: entrada dos passos (120 ms entre eles) */
  var listas = document.querySelectorAll('.passos--seq');
  if (reduzir || !('IntersectionObserver' in window)) {
    listas.forEach(function (l) { l.classList.add('visto'); });
  } else {
    var obsPassos = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('visto');
        obsPassos.unobserve(en.target);
        /* depois da entrada, o atraso sai (senão a troca do passo ativo herda os 120 ms por passo) */
        setTimeout(function () { en.target.querySelectorAll('.passo').forEach(function (p) { p.style.setProperty('--i', '0'); }); }, 1200);
      });
    }, { threshold: 0.2 });
    listas.forEach(function (l) { obsPassos.observe(l); });
  }

  /* 2b. Crossfade da foto pelo passo ativo (≥ 900px). Mede na carga e no resize; o handler só troca classe. */
  document.querySelectorAll('[data-sessao]').forEach(function (grade) {
    var midias = grade.querySelectorAll('.sessao__midia');
    var passos = grade.querySelectorAll('.passo');
    if (midias.length < 2 || !passos.length) return;
    var centros = [], ativo = -1;
    var medir = function () {
      var y0 = window.__lenis ? window.__lenis.scroll : window.scrollY;
      centros = Array.prototype.map.call(passos, function (p) { var r = p.getBoundingClientRect(); return r.top + y0 + r.height / 2; });
    };
    var marcar = function (i) {
      if (i === ativo) return;
      ativo = i;
      passos.forEach(function (p, k) { p.classList.toggle('ativo', k === i && computador.matches); });
      midias.forEach(function (m, k) { m.classList.toggle('ativo', k === Math.min(i, midias.length - 1)); });
    };
    window.addEventListener('load', medir);
    window.addEventListener('resize', function () { medir(); ativo = -1; });
    medir();
    window.aoRolar(function (d) {
      if (!computador.matches) { if (ativo !== 0) marcar(0); return; }
      var meio = d.scroll + window.innerHeight / 2, melhor = 0, dist = Infinity;
      for (var k = 0; k < centros.length; k++) {
        var x = Math.abs(centros[k] - meio);
        if (x < dist) { dist = x; melhor = k; }
      }
      marcar(melhor);
    });
  });

  /* 3. FAQ: um item aberto por vez */
  document.querySelectorAll('.faq').forEach(function (faq) {
    var itens = faq.querySelectorAll('details');
    itens.forEach(function (alvo) {
      alvo.addEventListener('toggle', function () {
        if (!alvo.open) return;
        itens.forEach(function (d) { if (d !== alvo && d.open) d.open = false; });
      });
    });
  });

  /* 4. Separador "·" (helper sep() do build): se o bloco antes e o depois ficam em linhas diferentes, o "·" sai e o
     bloco seguinte abre a linha. Em ordem, porque cada troca muda a linha dos seguintes. */
  var seps = document.querySelectorAll('.sep');
  if (seps.length) {
    var separar = function () {
      seps.forEach(function (s) { s.classList.remove('sep--linha'); });
      seps.forEach(function (s) {
        var a = s.previousElementSibling, b = s.nextElementSibling;
        if (!a || !b) return;
        var ra = a.getClientRects(), rb = b.getClientRects();
        if (!ra.length || !rb.length) return;
        if (Math.abs(rb[0].top - ra[ra.length - 1].top) > 2) s.classList.add('sep--linha');
      });
    };
    var pedido = 0;
    var agendar = function () { cancelAnimationFrame(pedido); pedido = requestAnimationFrame(separar); };
    separar();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(separar);
    window.addEventListener('load', separar);
    window.addEventListener('resize', agendar);
  }
})();
