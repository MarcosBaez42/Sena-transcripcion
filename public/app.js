const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const messages = document.getElementById('messages');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  addMessage(`Subiendo ${file.name}...`, 'user');

  const data = new FormData();
  data.append('audio', file);

  try {
    const res = await fetch('/api/transcribir', {
      method: 'POST',
      body: data,
    });
    if (!res.ok) {
      try {
        const data = await res.json();
        throw new Error(data.error || 'Error en la solicitud');
      } catch {
        const errorText = await res.text();
        throw new Error(errorText || 'Error en la solicitud');
      }
    }
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    addMessage(json.contenido, 'bot');
  } catch (err) {
    addMessage('Error: ' + err.message, 'bot');
  }
});

function addMessage(text, role) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}