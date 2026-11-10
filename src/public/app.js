const form = document.getElementById('form');
const input = document.getElementById('input');
const chatArea = document.getElementById('chatArea');

document.querySelectorAll('.suggest').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    input.value = a.textContent;
    form.dispatchEvent(new Event('submit'));
  });
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;

  const welcome = chatArea.querySelector('.welcome');
  if (welcome) welcome.remove();

  const msg = document.createElement('div');
  msg.className = 'message';
  msg.innerHTML = `<div class="q">Q: ${esc(q)}</div><div class="a"><span class="cursor"></span></div>`;
  chatArea.appendChild(msg);
  chatArea.scrollTop = chatArea.scrollHeight;

  const ansEl = msg.querySelector('.a');
  input.value = '';
  input.disabled = true;
  form.querySelector('button').disabled = true;

  try {
    const es = new EventSource(`/api/ask?q=${encodeURIComponent(q)}`);
    let sources = [];

    es.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.type === 'sources') {
        sources = data.sources;
      } else if (data.type === 'delta') {
        const cursor = ansEl.querySelector('.cursor');
        if (cursor) cursor.remove();
        ansEl.insertAdjacentText('beforeend', data.content);
        ansEl.insertAdjacentHTML('beforeend', '<span class="cursor"></span>');
        chatArea.scrollTop = chatArea.scrollHeight;
      } else if (data.type === 'done') {
        es.close();
        finish(msg, ansEl, sources);
      } else if (data.type === 'error') {
        es.close();
        ansEl.innerHTML = `<span class="error">Error: ${esc(data.message)}</span>`;
        unlock();
      }
    };

    es.onerror = () => {
      es.close();
      ansEl.innerHTML += `<span class="error"> (连接断开)</span>`;
      unlock();
    };
  } catch (err) {
    ansEl.innerHTML = `<span class="error">${esc(err.message)}</span>`;
    unlock();
  }
});

function finish(msg, ansEl, sources) {
  const cursor = ansEl.querySelector('.cursor');
  if (cursor) cursor.remove();

  if (sources.length) {
    const div = document.createElement('div');
    div.className = 'sources';
    for (const s of sources) {
      const card = document.createElement('div');
      card.className = 'source-card';
      const date = new Date(s.ingestedAt).toLocaleDateString('zh-CN');
      const preview = s.text.replace(/\[来源:.*?\]\n/, '').slice(0, 200);
      card.innerHTML = `
        <span class="score">${(s.score * 100).toFixed(0)}%</span>
        <div class="path">${esc(s.path)}</div>
        <div class="heading">${esc(s.heading || '—')}</div>
        <div class="meta">更新: ${date}</div>
        <div class="preview">${esc(preview)}…</div>
      `;
      card.addEventListener('click', () => card.classList.toggle('expanded'));
      div.appendChild(card);
    }
    msg.appendChild(div);
  }
  chatArea.scrollTop = chatArea.scrollHeight;
  unlock();
}

function unlock() {
  input.disabled = false;
  form.querySelector('button').disabled = false;
  input.focus();
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
