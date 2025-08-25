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

  xhr.upload.addEventListener('progress', (event) => {
    const percent = Math.round((event.loaded / file.size) * 100);
    progressBar.style.width = `${percent}%`;
    progressBar.textContent = `${percent}%`;
  });

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.error) throw new Error(json.error);

        const intervenciones = json.contenido
          .split(/\n+/)
          .filter(Boolean);

        intervenciones.forEach((line) => addMessage(line, 'bot'));
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

  xhr.onloadend = () => {
    progress.style.display = 'none';
    progressBar.textContent = '';
  };

  xhr.send(data);
});

function addMessage(text, role) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}