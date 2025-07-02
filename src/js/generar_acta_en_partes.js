const fs = require("fs");
const path = require("path");
require('dotenv').config();

const { GeneradorActas } = require("./generar_acta");

async function generarActaDesdeArchivo(archivoTranscripcion) {
  if (!fs.existsSync(archivoTranscripcion)) {
    console.error(`❌ No encontré el archivo: ${archivoTranscripcion}`);
    return;
  }

  const texto = fs.readFileSync(archivoTranscripcion, 'utf-8');
  const generador = new GeneradorActas();
  await new Promise(r => setTimeout(r, 1000));

  const info = {
    nombreDelProyecto: path.basename(archivoTranscripcion, path.extname(archivoTranscripcion)).replace('_transcripcion',''),
    fechaDeHoy: new Date().toLocaleDateString('es-CO')
  };

  const resultado = await generador.generarActaEnDosPartes(texto, info);
  if (resultado) {
    console.log(`\n🎉 Acta completa en: ${resultado.archivo}`);
  }
}

if (require.main === module) {
  if (process.argv.length < 3) {
    console.log("Uso: node generar_acta_en_partes.js <archivo_transcripcion>");
    process.exit(1);
  }
  generarActaDesdeArchivo(process.argv[2]);
}