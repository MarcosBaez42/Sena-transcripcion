const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');

try { require('dotenv').config(); } catch {}

const { transcribirUnSoloArchivo } = require('../js/transcribir');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Servir archivos estáticos de la carpeta public
app.use(express.static(path.join(__dirname, '..', '..', 'public')));

app.post('/api/transcribir', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }

    const rutaAbsoluta = path.resolve(req.file.path);
    const resultado = await transcribirUnSoloArchivo(rutaAbsoluta);
    const contenido = fs.readFileSync(resultado.transcripcion, 'utf-8');

    res.json({ ruta: resultado.transcripcion, contenido });
  } catch (error) {
    console.error('Error en /api/transcribir:', error);
    res.status(500).json({ error: 'Error al transcribir el archivo' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
