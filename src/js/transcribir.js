const fs = require('fs');
const path = require('path');

try { require('dotenv').config(); } catch { console.warn('⚠️  No pude cargar el archivo .env'); }

const { buscarArchivosDeAudioProcesado } = require('./partes_audio');
const { transcribirUnaParte } = require('./transcribir_parte');
const { combinarTodasLasTranscripciones, verificarSiHablantesEstanRegistrados } = require('./combinar_transcripciones');
const { generarDocumentoWord } = require('./generador_documento');
const { extraerInformacionDelAudio } = require('./metadatos');
const { generarActaConInteligenciaArtificial, puedeUsarGemini } = require('./generador_actas');

const directorioDelProyecto = path.resolve(__dirname, '../../'),
      carpetaAudioProcesado = path.join(directorioDelProyecto, 'audio_procesado'),
      archivoPlantillaWord = path.join(directorioDelProyecto, 'config/plantilla.docx'),
      archivoHablantes = path.join(directorioDelProyecto, 'config/hablantes.json'),
      scriptPythonTranscribir = path.join(directorioDelProyecto, 'src/python/transcribir.py');

const modoSilencioso = process.argv.includes('--quiet');
if (modoSilencioso) process.argv = process.argv.filter(argumento => argumento !== '--quiet');
const argumentosExtraPython = modoSilencioso ? ['--quiet'] : [];

async function transcribirAudioCompletoPorPartes() {
  const archivosParaProcesar = buscarArchivosDeAudioProcesado(carpetaAudioProcesado);
  if (!archivosParaProcesar.length) {
    console.error('❌ No encontré archivos de audio procesados.');
    console.log('💡 Ejecuta primero el preprocesador de audio');
    return;
  }
  console.log(`📋 Encontré ${archivosParaProcesar.length} partes para transcribir:`);
  archivosParaProcesar.forEach(parte => console.log(`   - Parte ${parte.numeroParte}: ${parte.nombreArchivo}`));

  const transcripciones = [];
  for (const parte of archivosParaProcesar) {
    try {
      console.log(`\n📝 PROCESANDO PARTE ${parte.numeroParte}/${archivosParaProcesar.length}`);
      const inicio = Date.now();
      const transcripcion = await transcribirUnaParte(parte, scriptPythonTranscribir, directorioDelProyecto, argumentosExtraPython);
      console.log(`✅ Parte ${transcripcion.parte} completada en ${((Date.now()-inicio)/1000).toFixed(1)}s`);
      transcripciones.push(transcripcion);
    } catch (error) {
      console.error(`❌ Problemas con la parte ${parte.numeroParte}:`, error.message);
    }
  }
  if (!transcripciones.length) return console.error('❌ No pude transcribir ninguna parte.');

  const combinado = combinarTodasLasTranscripciones(transcripciones);
  const nombreBase = path.basename(archivosParaProcesar[0].nombreArchivo, path.extname(archivosParaProcesar[0].nombreArchivo));
  const nombreDelProyecto = nombreBase.replace(/_parte_\d+$/, '');
  const informacion = extraerInformacionDelAudio(nombreDelProyecto, combinado.textoCompleto);

  const carpetaProyecto = path.join(directorioDelProyecto, nombreDelProyecto);
  if (!fs.existsSync(carpetaProyecto)) fs.mkdirSync(carpetaProyecto, { recursive: true });
  const archivoTranscripcionCompleta = path.join(carpetaProyecto, `${nombreDelProyecto}_transcripcion.txt`);
  fs.writeFileSync(archivoTranscripcionCompleta, combinado.textoCompleto, 'utf-8');

  let actaIA = null;
  if (puedeUsarGemini) actaIA = await generarActaConInteligenciaArtificial(combinado.textoCompleto, informacion);

  console.log(`👥 Hablantes detectados: ${combinado.listaHablantes.sort((primero, segundo) => primero - segundo).map(hablante => `HABLANTE ${hablante}`).join(', ')}`);
  if (verificarSiHablantesEstanRegistrados(combinado.listaHablantes, archivoHablantes)) {
    generarDocumentoWord(combinado.textoCompleto, nombreDelProyecto, {}, archivoPlantillaWord, directorioDelProyecto);
  }

  console.log(`📄 Transcripción: ${archivoTranscripcionCompleta}`);
  if (actaIA) console.log(`🤖 Acta con Gemini: ${actaIA.archivoGenerado}`);
}

async function transcribirUnSoloArchivo(rutaCompletaDelAudio) {
  const carpetaDelArchivo = path.dirname(rutaCompletaDelAudio);
  const nombreDelArchivo = path.basename(rutaCompletaDelAudio, path.extname(rutaCompletaDelAudio));
  const archivoTranscripcionEsperado = path.join(carpetaDelArchivo, `${nombreDelArchivo}_transcripcion.txt`);

  try {
    await transcribirUnaParte({ nombreArchivo: path.basename(rutaCompletaDelAudio), rutaCompleta: rutaCompletaDelAudio, numeroParte: 1 }, scriptPythonTranscribir, directorioDelProyecto, argumentosExtraPython);

    let archivoEncontrado = archivoTranscripcionEsperado;
    if (!fs.existsSync(archivoEncontrado)) {
      const alternativas = [
        path.join(directorioDelProyecto, `${nombreDelArchivo}_transcripcion.txt`),
        path.join(carpetaDelArchivo, `${nombreDelArchivo}_transcripcion.txt`)
      ];
      archivoEncontrado = alternativas.find(ruta => fs.existsSync(ruta));
      if (!archivoEncontrado) throw new Error('No se encontró la transcripción');
    }

    const carpetaDestino = path.join(directorioDelProyecto, nombreDelArchivo);
    if (!fs.existsSync(carpetaDestino)) fs.mkdirSync(carpetaDestino, { recursive: true });
    const destinoFinal = path.join(carpetaDestino, `${nombreDelArchivo}_transcripcion.txt`);
    if (archivoEncontrado !== destinoFinal) { fs.renameSync(archivoEncontrado, destinoFinal); archivoEncontrado = destinoFinal; }

    const textoTranscrito = fs.readFileSync(archivoEncontrado, 'utf-8');
    const hablantes = [...new Set([...textoTranscrito.matchAll(/HABLANTE (\w+|\d+)/g)].map(coincidencia => coincidencia[1]))];
    const informacion = extraerInformacionDelAudio(nombreDelArchivo, textoTranscrito);
    let acta = null;
    if (puedeUsarGemini) acta = await generarActaConInteligenciaArtificial(textoTranscrito, informacion);

    if (verificarSiHablantesEstanRegistrados(hablantes, archivoHablantes)) {
      generarDocumentoWord(textoTranscrito, nombreDelArchivo, {}, archivoPlantillaWord, directorioDelProyecto);
    }

    console.log(`📄 Transcripción: ${archivoEncontrado}`);
    if (acta) console.log(`🤖 Acta con Gemini: ${acta.archivoGenerado}`);
    return { transcripcion: archivoEncontrado, acta, informacion };
  } catch (error) {
    console.error('❌ Tuve problemas procesando los archivos:', error);
    throw error;
  }
}

if (require.main === module) {
  console.log('🎬 INICIANDO SISTEMA DE TRANSCRIPCIÓN');
  if (process.argv.length > 2) {
    const archivoDeAudio = process.argv[2];
    console.log(`📁 Voy a procesar el archivo: ${archivoDeAudio}`);
    transcribirUnSoloArchivo(archivoDeAudio).catch(error => { console.error('❌ Error:', error.message); process.exit(1); });
  } else {
    transcribirAudioCompletoPorPartes().catch(error => { console.error('❌ Error:', error.message); process.exit(1); });
  }
}

module.exports = { transcribirAudioCompletoPorPartes, transcribirUnSoloArchivo };