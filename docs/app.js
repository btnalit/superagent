(function () {
  'use strict';

  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      navLinks.classList.toggle('open');
    });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { navLinks.classList.remove('open'); });
    });
  }

  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 20) nav.classList.add('nav-scrolled');
    else nav.classList.remove('nav-scrolled');
  });

  var revealEls = document.querySelectorAll('[data-reveal]');
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(function (el) { observer.observe(el); });

  var heroTerminal = document.getElementById('heroTerminal');
  var heroLines = [
    { type: 'prompt', text: 'You: ' },
    { type: 'input', text: 'install skill from https://example.com/daily-digest.md' },
    { type: 'tool', text: '  [Using: install_skill]' },
    { type: 'output', text: '  Skill "daily-digest" installed successfully.' },
    { type: 'prompt', text: 'You: ' },
    { type: 'input', text: 'schedule daily-digest every day at 9am' },
    { type: 'tool', text: '  [Using: schedule_task]' },
    { type: 'output', text: '  Task scheduled: daily-digest (cron: 0 9 * * *)' },
    { type: 'prompt', text: 'You: ' },
    { type: 'input', text: 'fetch latest repos of hotheadhacker' },
    { type: 'tool', text: '  [Using: fetch_url]' },
    { type: 'agent', text: 'Mercury: ' },
    { type: 'stream', text: 'Here are the latest repositories by hotheadhacker: **sekond-brain** (updated today), **no-as-a-service** (7.1k stars)...' },
  ];

  var demoTerminal = document.getElementById('demoTerminal');
  var demoLines = [
    { type: 'prompt', text: 'You: ' },
    { type: 'input', text: 'read the package.json and tell me the deps' },
    { type: 'tool', text: '  [Using: read_file]' },
    { type: 'prompt', text: 'You: ' },
    { type: 'input', text: 'edit the version to 0.2.0' },
    { type: 'tool', text: '  [Using: edit_file]' },
    { type: 'output', text: '  Successfully replaced "0.1.0" with "0.2.0" in package.json' },
    { type: 'prompt', text: 'You: ' },
    { type: 'input', text: 'commit that change' },
    { type: 'tool', text: '  [Using: git_add, git_commit]' },
    { type: 'output', text: '  [git add package.json] [git commit -m "bump version to 0.2.0"]' },
    { type: 'prompt', text: 'You: ' },
    { type: 'input', text: 'send me the package.json file' },
    { type: 'tool', text: '  [Using: send_file]' },
    { type: 'output', text: '  File sent: package.json (1.2KB)' },
    { type: 'agent', text: 'Mercury: ' },
    { type: 'stream', text: 'Done! I\'ve read the package.json, updated the version, committed the change, and sent you the file. Anything else?' },
  ];

  function typeTerminal(container, lines, speed, callback) {
    var idx = 0;
    var charIdx = 0;
    var currentSpan = null;

    function nextLine() {
      if (idx >= lines.length) {
        if (callback) callback();
        return;
      }
      var line = lines[idx];

      if (line.type === 'prompt') {
        var span = document.createElement('span');
        span.className = 'prompt';
        span.textContent = line.text;
        container.appendChild(span);
        idx++;
        nextLine();
        return;
      }

      if (line.type === 'input') {
        currentSpan = document.createElement('span');
        currentSpan.style.color = '#f0f0f0';
        container.appendChild(currentSpan);
        charIdx = 0;
        typeChars(line.text, function () {
          container.appendChild(document.createElement('br'));
          idx++;
          nextLine();
        });
        return;
      }

      if (line.type === 'tool') {
        var toolSpan = document.createElement('span');
        toolSpan.className = 'tool';
        toolSpan.textContent = line.text;
        container.appendChild(toolSpan);
        container.appendChild(document.createElement('br'));
        idx++;
        setTimeout(nextLine, speed * 2);
        return;
      }

      if (line.type === 'output') {
        var outSpan = document.createElement('span');
        outSpan.className = 'output';
        outSpan.textContent = line.text;
        container.appendChild(outSpan);
        container.appendChild(document.createElement('br'));
        idx++;
        setTimeout(nextLine, speed);
        return;
      }

      if (line.type === 'agent') {
        var aSpan = document.createElement('span');
        aSpan.className = 'agent';
        aSpan.textContent = line.text;
        container.appendChild(aSpan);
        idx++;
        nextLine();
        return;
      }

      if (line.type === 'stream') {
        currentSpan = document.createElement('span');
        currentSpan.style.color = '#f0f0f0';
        container.appendChild(currentSpan);
        charIdx = 0;
        typeChars(line.text, function () {
          container.appendChild(document.createElement('br'));
          idx++;
          var cursor = document.createElement('span');
          cursor.className = 'cursor';
          container.appendChild(cursor);
          if (callback) callback();
        }, speed * 1.5);
        return;
      }

      idx++;
      nextLine();
    }

    function typeChars(text, done, customSpeed) {
      var s = customSpeed || speed;
      if (charIdx >= text.length) {
        done();
        return;
      }
      currentSpan.textContent += text[charIdx];
      charIdx++;
      container.scrollTop = container.scrollHeight;
      setTimeout(function () { typeChars(text, done, customSpeed); }, s);
    }

    nextLine();
  }

  var heroObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        heroObs.unobserve(entry.target);
        typeTerminal(heroTerminal, heroLines, 25);
      }
    });
  }, { threshold: 0.3 });
  if (heroTerminal) heroObs.observe(heroTerminal);

  var demoObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        demoObs.unobserve(entry.target);
        typeTerminal(demoTerminal, demoLines, 18);
      }
    });
  }, { threshold: 0.3 });
  if (demoTerminal) demoObs.observe(demoTerminal);

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  fetch('https://api.github.com/repos/cosmicstack-labs/mercury-agent')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var el = document.getElementById('ghStars');
      if (el && data.stargazers_count != null) {
        var n = data.stargazers_count;
        el.textContent = n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : n;
      }
    })
    .catch(function () {});
})();