const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

try { require('dotenv').config(); } catch {}

const { transcribirUnSoloArchivo } = require('../js/transcribir');

const app = express();
fs.mkdirSync('uploads', { recursive: true });
const upload = multer({ dest: 'uploads/' });

// Servir archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.post('/api/transcribir', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const rutaAbsoluta = path.resolve(req.file.path);
    console.log('Llamando a transcribirUnSoloArchivo con:', rutaAbsoluta);
    const resultado = await transcribirUnSoloArchivo(rutaAbsoluta);
    if (!resultado || typeof resultado !== 'object' || !resultado.transcripcion) {
      throw new Error('transcribirUnSoloArchivo no devolvió una ruta de transcripción');
    }
    const contenido = fs.readFileSync(resultado.transcripcion, 'utf-8');
    console.log('Enviando respuesta con transcripción en:', resultado.transcripcion);

    res.json({ ruta: resultado.transcripcion, contenido });
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error('Error al eliminar el archivo temporal:', err);
      }
    });
  } catch (error) {
    console.error('Error en /api/transcribir:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});