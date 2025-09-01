const form = document.getElementById('upload-form');
const fileInput = document.getElementById('file-input');
const messages = document.getElementById('messages');
const fileName = document.getElementById('file-name');
const progress = document.getElementById('progress');
const progressBar = document.getElementById('progress-bar');
const downloadSection = document.getElementById('download-section');
const downloadBtn = document.getElementById('download-btn');
const checkboxes = downloadSection.querySelectorAll('input[type="checkbox"]');
const previewContainer = document.getElementById('preview-container');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const historyList = document.getElementById('history-list');
const dropArea = document.getElementById('drop-area');
const toastContainer = document.getElementById('toast-container');
let currentId = null;

downloadBtn.disabled = true;
checkboxes.forEach((cb) => (cb.disabled = true));

previewContainer.style.display = 'none';

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  fileName.textContent = file ? file.name : '';
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropArea.addEventListener(eventName, (e) => {
    e.preventDefault();
    dropArea.classList.remove('dragover');
  });
});

dropArea.addEventListener('drop', (e) => {
  const files = e.dataTransfer.files;
  if (files && files.length > 0) {
    fileInput.files = files;
    fileInput.dispatchEvent(new Event('change'));
  }
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;
  
  currentId = null;
  downloadBtn.disabled = true;
  checkboxes.forEach((cb) => {
    cb.checked = false;
    cb.disabled = true;
  });

  addMessage(`Subiendo ${file.name}...`, 'user');

  messages.style.display = 'block';
  messages.innerHTML = '';
  previewContainer.style.display = 'none';
  previewContainer.innerHTML = '';

  const data = new FormData();
  data.append('audio', file);

  progress.style.display = 'block';
  progressBar.style.width = '0%';
  progressBar.textContent = '0%';

  const xhr = new XMLHttpRequest();
    xhr.open('POST', window.API_BASE + '/transcribir');

  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.error) throw new Error(json.error);

          const { id } = json;
          const sse = new EventSource(window.API_BASE + '/progreso/' + id);
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
              if (data.id) currentId = data.id;
              const history = JSON.parse(
                localStorage.getItem('historialTranscripciones') || '[]'
              );
              history.push({ id: currentId, nombre: file.name, fecha: Date.now() });
              localStorage.setItem(
                'historialTranscripciones',
                JSON.stringify(history)
              );
              renderHistory();
              sse.close();
              progress.style.display = 'none';
              progressBar.textContent = '';
              downloadBtn.disabled = false;
              checkboxes.forEach((cb) => (cb.disabled = false));
              showToast('Transcripción completada', 'success');

                fetch(`${window.API_BASE}/descargar?id=${currentId}&tipo=docx`)
                .then((res) => {
                  if (!res.ok)
                    throw new Error('No se pudo obtener el documento');
                  return res.blob();
                })
                .then((blob) => {
                  previewContainer.innerHTML = '';
                  return window.docx.renderAsync(blob, previewContainer);
                })
                .then(() => {
                  previewContainer.style.display = 'block';
                  messages.style.display = 'none';
                })
                .catch((err) => {
                  messages.style.display = 'block';
                  addMessage('Error: ' + err.message, 'bot');
                  showToast('Error: ' + err.message, 'error');
                });
            }
            if (data.error) {
              addMessage('Error: ' + data.error, 'bot');
              showToast('Error: ' + data.error, 'error');
              sse.close();
              progress.style.display = 'none';
              progressBar.textContent = '';
            }
          } catch (err) {
            addMessage('Error: ' + err.message, 'bot');
            showToast('Error: ' + err.message, 'error');
          }
        };
      } catch (err) {
        addMessage('Error: ' + err.message, 'bot');
        showToast('Error: ' + err.message, 'error');
      }
    } else {
      addMessage(
        'Error del servidor: ' + xhr.status + ' ' + xhr.statusText,
        'bot'
      );
      showToast(
        'Error del servidor: ' + xhr.status + ' ' + xhr.statusText,
        'error'
      );
    }
  };

  xhr.onerror = () => {
    addMessage('Error de red', 'bot');
    showToast('Error de red', 'error');
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

function showToast(text, type = 'success') {
  const div = document.createElement('div');
  div.className = `toast toast-${type}`;
  div.textContent = text;
  toastContainer.appendChild(div);
  requestAnimationFrame(() => div.classList.add('toast-show'));
  setTimeout(() => {
    div.classList.remove('toast-show');
    setTimeout(() => div.remove(), 300);
  }, 3000);
}

function removeHistory(id) {
  const history = JSON.parse(
    localStorage.getItem('historialTranscripciones') || '[]'
  );
  const updated = history.filter((item) => item.id !== id);
  localStorage.setItem('historialTranscripciones', JSON.stringify(updated));
}

function downloadArchivo(id, tipo) {
  fetch(
    `${window.API_BASE}/descargar?id=${encodeURIComponent(id)}&tipo=${tipo}`
  )
    .then((res) => {
      if (res.status === 404) {
        removeHistory(id);
        renderHistory();
        throw new Error('Transcripción no encontrada');
      }
      if (!res.ok) throw new Error('No pude descargar ' + tipo);
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const nombre = match ? match[1] : `archivo.${tipo}`;
      return res.blob().then((blob) => ({ blob, nombre }));
    })
    .then(({ blob, nombre }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch((err) => {
      addMessage('Error: ' + err.message, 'bot');
      showToast('Error: ' + err.message, 'error');
    });
}

function renderHistory() {
  historyList.innerHTML = '';
  const history = JSON.parse(
    localStorage.getItem('historialTranscripciones') || '[]'
  );
  history.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item.nombre;
    li.addEventListener('click', () => {
      currentId = item.id;
      fetch(
        `${window.API_BASE}/descargar?id=${encodeURIComponent(item.id)}&tipo=docx`
      )
        .then((res) => {
          if (res.status === 404) {
            removeHistory(item.id);
            renderHistory();
            throw new Error('Transcripción no encontrada');
          }
          if (!res.ok) throw new Error('No se pudo obtener el documento');
          return res.blob();
        })
        .then((blob) => {
          previewContainer.innerHTML = '';
          return window.docx.renderAsync(blob, previewContainer);
        })
        .then(() => {
          previewContainer.style.display = 'block';
          messages.style.display = 'none';
          downloadBtn.disabled = false;
          checkboxes.forEach((cb) => (cb.disabled = false));
          sidebar.classList.add('hidden');
          sidebar.classList.remove('visible');
        })
        .catch((err) => {
          addMessage('Error: ' + err.message, 'bot');
          showToast('Error: ' + err.message, 'error');
        });
    });
    historyList.appendChild(li);
  });
}

downloadBtn.addEventListener('click', () => {
  if (!currentId) return;
  const formatos = Array.from(
    downloadSection.querySelectorAll('input[type="checkbox"]:checked')
  ).map((cb) => cb.value);
  if (formatos.length === 0) return;

  if (formatos.length === 1) {
      const tipo = formatos[0];
      fetch(`${window.API_BASE}/descargar?id=${encodeURIComponent(currentId)}&tipo=${tipo}`)
      .then((res) => {
        if (!res.ok) throw new Error('No pude descargar ' + tipo);
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = /filename="?([^";]+)"?/i.exec(disposition);
        const nombre = match ? match[1] : `archivo.${tipo}`;
        return res.blob().then((blob) => ({ blob, nombre }));
      })
      .then(({ blob, nombre }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        addMessage('Error: ' + err.message, 'bot');
        showToast('Error: ' + err.message, 'error');
      });
    return;
  }

    const urlZip = `${window.API_BASE}/descargar-zip?id=${encodeURIComponent(
      currentId
    )}&tipos=${formatos.join(',')}`;
  fetch(urlZip)
    .then((res) => {
      if (!res.ok) throw new Error('No pude descargar ZIP');
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const nombre = match ? match[1] : 'archivos.zip';
      return res.blob().then((blob) => ({ blob, nombre }));
    })
    .then(({ blob, nombre }) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    })
    .catch((err) => {
      addMessage('Error: ' + err.message, 'bot');
      showToast('Error: ' + err.message, 'error');
    });
});

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('visible');
  sidebar.classList.toggle('hidden');
});

document.addEventListener('DOMContentLoaded', renderHistory);