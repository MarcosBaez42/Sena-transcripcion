const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');

try { require('dotenv').config(); } catch {}

const { transcribirUnSoloArchivo } = require('../js/transcribir');

const app = express();
fs.mkdirSync('uploads', { recursive: true });
const upload = multer({ dest: 'uploads/' });

// Conexiones SSE activas
const conexiones = new Map();
// Archivos generados por ID
const archivosGenerados = new Map();

// Servir archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

// Endpoint SSE para escuchar el progreso de la transcripción
app.get('/api/progreso/:id', (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();
  conexiones.set(id, res);
  req.on('close', () => conexiones.delete(id));
});

app.post('/api/transcribir', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const id = randomUUID();
    const rutasDescarga = {
      txt: `/api/descargar?id=${id}&tipo=txt`,
      md: `/api/descargar?id=${id}&tipo=md`,
      docx: `/api/descargar?id=${id}&tipo=docx`
    };
    res.json({ id, archivos: rutasDescarga });

    const rutaAbsoluta = path.resolve(req.file.path);
    console.log('Llamando a transcribirUnSoloArchivo con:', rutaAbsoluta);

    const enviar = (payload) => {
      const cliente = conexiones.get(id);
      if (cliente) {
        cliente.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    const finalizar = () => {
      const cliente = conexiones.get(id);
      if (cliente) {
        cliente.end();
        conexiones.delete(id);
      }
    };

      setImmediate(async () => {
        try {
          const resultado = await transcribirUnSoloArchivo(rutaAbsoluta, (msg) => {
            enviar({ progreso: msg });
          });
          if (!resultado || typeof resultado !== 'object' || !resultado.transcripcion) {
            throw new Error('transcribirUnSoloArchivo no devolvió una ruta de transcripción');
          }
          archivosGenerados.set(id, resultado.rutasRelativas);
          const contenido = fs.readFileSync(resultado.transcripcion, 'utf-8');
          enviar({ final: contenido, id });
        } catch (err) {
          console.error('Error en transcripción:', err);
          enviar({ error: err.message });
        } finally {
          finalizar();
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error al eliminar el archivo temporal:', err);
          });
        }
      });
  } catch (error) {
    console.error('Error en /api/transcribir:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.get('/api/descargar', (req, res) => {
  const { id, tipo } = req.query;
  const permitidos = ['txt', 'md', 'docx'];
  if (!permitidos.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo no válido' });
  }
  const archivos = archivosGenerados.get(id);
  if (!archivos) {
    return res.status(404).json({ error: 'ID no válido' });
  }
  const relativa = archivos[tipo];
  if (!relativa) {
    return res.status(404).json({ error: 'Archivo no disponible' });
  }
  const base = path.resolve(__dirname, '..', '..');
  const ruta = path.resolve(base, relativa);
  if (!ruta.startsWith(base)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  if (!fs.existsSync(ruta)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }
  res.download(ruta, (err) => {
    if (err) console.error('Error al enviar archivo:', err);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});