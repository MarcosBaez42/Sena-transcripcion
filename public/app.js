const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const messages = document.getElementById('messages');
const fileName = document.getElementById('file-name');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progress-bar');

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileName.textContent = file ? file.name : '';
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  addMessage(`Subiendo ${file.name}...`, 'user');

  const data = new FormData();
  data.append('audio', file);

  progress.style.display = 'block';
  progressBar.style.width = '0%';
  progressBar.textContent = '0%';

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/transcribir');

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.error) throw new Error(json.error);

        const { id } = json;
        const sse = new EventSource('/api/progreso/' + id);
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';

        sse.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.progreso !== undefined) {
               const percent = Number(data.progreso);
              if (!Number.isNaN(percent)) {
                const limitado = Math.min(percent, 100);
                progressBar.style.width = `${limitado}%`;
                progressBar.textContent = `${limitado}%`;
              }
            }
            if (data.final) {
              const intervenciones = data.final
                .split(/\n+/)
                .filter(Boolean);
              intervenciones.forEach((line) => addMessage(line, 'bot'));
              sse.close();
              progress.style.display = 'none';
              progressBar.textContent = '';
            }
            if (data.error) {
              addMessage('Error: ' + data.error, 'bot');
              sse.close();
              progress.style.display = 'none';
              progressBar.textContent = '';
            }
          } catch (err) {
            addMessage('Error: ' + err.message, 'bot');
          }
        };
      } catch (err) {
        addMessage('Error: ' + err.message, 'bot');
      }
    } else {
      addMessage(
        'Error del servidor: ' + xhr.status + ' ' + xhr.statusText,
        'bot'
      );
    }
  };

  xhr.onerror = () => {
    addMessage('Error de red', 'bot');
  };

  xhr.onloadend = () => {};

  xhr.send(data);
});

function addMessage(text, role) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}