// Transcriptor de Audio para Comités SENA
// Desarrollado durante mis prácticas en el Centro Agroturístico
// Este script me ayuda a transcribir las reuniones de comité y generar las actas
// Autor: Estudiante en práctica - Análisis y Desarrollo de Software

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

// Librerías para generar documentos Word (aprendí esto en el proyecto)
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

// Intenté cargar las variables de entorno como me enseñaron
try {
    require('dotenv').config();
} catch (error) {
    console.warn("⚠️  No pude cargar el archivo .env, pero seguiré intentando...");
}

// Determina si podemos usar Gemini basándonos en la presencia de la clave API
const puedeUsarGemini = Boolean(process.env.GEMINI_API_KEY);

// Aquí voy a intentar usar el generador de actas que hice con Gemini
let GeneradorActasConIA;
let modoGenerador = null;

try {
    if (process.env.GEMINI_API_KEY) {
        console.log("🤖 Gemini habilitado para generación de actas");
        const { GeneradorActas } = require('./generar_acta');
        GeneradorActasConIA = GeneradorActas;
        modoGenerador = "gemini";
    } else {
        console.log("ℹ️  No hay modelo de IA configurado. Solo se hará transcripción.");
    }
} catch (error) {
    console.warn("⚠️  No se pudo cargar el generador de actas:", error.message);
}

// ============================================================================
// CONFIGURACIÓN DE RUTAS - Esto lo aprendí después de mucho trial and error
// ============================================================================

// Me di cuenta que necesitaba el directorio raíz para que funcionara bien
const directorioDelProyecto = path.resolve(__dirname, '../../');

// Estas rutas las configuré para que el sistema encuentre todo
const carpetaAudioProcesado = path.join(directorioDelProyecto, "audio_procesado");
const archivoPlantillaWord = path.join(directorioDelProyecto, "config/plantilla.docx");
const archivoHablantes = path.join(directorioDelProyecto, "config/hablantes.json");
const scriptPythonTranscribir = path.join(directorioDelProyecto, "src/python/transcribir.py");

console.log(`📁 Trabajando desde: ${directorioDelProyecto}`);

// ============================================================================
// FUNCIONES PARA DETECTAR INFORMACIÓN DEL AUDIO - Mi primera función importante!
// ============================================================================

function extraerInformacionDelAudio(nombreArchivo, textoTranscrito = "") {
    // Esta función la hice para extraer automáticamente la info de las actas
    const informacionDetectada = {
        nombreDelProyecto: nombreArchivo.replace(/(_transcripcion|_parte_\d+|_completa)/g, ''),
        fechaDeHoy: new Date().toLocaleDateString('es-CO'),
        programaAcademico: null,
        numeroFicha: null,
        nombreAprendiz: null,
        numeroDeActa: null,
        instructorPrincipal: null
    };

    // Aquí intento extraer información del texto transcrito
    if (textoTranscrito) {
        // Busco el programa 
        const patronesPrograma = [
            /programa\s+([^.]{15,150})/i,
            /técnico\s+en\s+([^.]{10,100})/i,
            /del\s+programa\s+([^.]{10,100})/i
        ];
        
        for (const patron of patronesPrograma) {
            const coincidencia = textoTranscrito.match(patron);
            if (coincidencia) {
                informacionDetectada.programaAcademico = coincidencia[1].trim().replace(/\s+/g, ' ');
                break;
            }
        }

        // Busco el número de ficha
        const patronesFicha = [
            /ficha\s*:?\s*(\d+[-\d]*)/i,
            /de\s+la\s+ficha\s+(\d+)/i,
            /ficha\s+número\s+(\d+)/i
        ];
        
        for (const patron of patronesFicha) {
            const coincidencia = textoTranscrito.match(patron);
            if (coincidencia) {
                informacionDetectada.numeroFicha = coincidencia[1];
                break;
            }
        }

        // Busco nombres de aprendices (esto fue complicado porque pueden ser varios)
        const patronesAprendices = [
            /aprendiz\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/g,
            /del\s+aprendiz\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/g,
            /estudiante\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/g
        ];
        
        const aprendicesEncontrados = new Set();
        for (const patron of patronesAprendices) {
            let coincidencia;
            while ((coincidencia = patron.exec(textoTranscrito)) !== null) {
                aprendicesEncontrados.add(coincidencia[1].trim());
            }
        }
        
        if (aprendicesEncontrados.size > 0) {
            informacionDetectada.nombreAprendiz = Array.from(aprendicesEncontrados).join(", ");
        }

        // Busco la fecha del comité
        const patronesFecha = [
            /(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i,
            /(\d{1,2}\/\d{1,2}\/\d{4})/i,
            /fecha[:\s]+([^.]{10,30})/i
        ];
        
        for (const patron of patronesFecha) {
            const coincidencia = textoTranscrito.match(patron);
            if (coincidencia) {
                informacionDetectada.fechaDeHoy = coincidencia[1].trim();
                break;
            }
        }

        // Busco el instructor principal
        const patronesInstructor = [
            /instructor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/i,
            /profesora?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/i
        ];
        
        for (const patron of patronesInstructor) {
            const coincidencia = textoTranscrito.match(patron);
            if (coincidencia) {
                informacionDetectada.instructorPrincipal = coincidencia[1].trim();
                break;
            }
        }
    }

    // Detectar desde el nombre del archivo (me di cuenta que algunos nombres son descriptivos)
    const nombreEnMinusculas = nombreArchivo.toLowerCase();
    if (nombreEnMinusculas.includes('fotovoltaicos')) {
        informacionDetectada.programaAcademico = informacionDetectada.programaAcademico || 'Técnico en Mantenimiento e Instalación de Sistemas Solares Fotovoltaicos';
    } else if (nombreEnMinusculas.includes('adso')) {
        informacionDetectada.programaAcademico = informacionDetectada.programaAcademico || 'Análisis y Desarrollo de Software';
    } else if (nombreEnMinusculas.includes('asistencia') || nombreEnMinusculas.includes('administrativa')) {
        informacionDetectada.programaAcademico = informacionDetectada.programaAcademico || 'Técnico en Asistencia Administrativa';
    } else if (nombreEnMinusculas.includes('agrotronica') || nombreEnMinusculas.includes('agrotrónica')) {
        informacionDetectada.programaAcademico = informacionDetectada.programaAcademico || 'Técnico en Agrotrónica';
    }

    // Genero un número de acta si no hay uno (formato que vi en las actas del SENA)
    if (!informacionDetectada.numeroDeActa) {
        const codigoFecha = new Date().getFullYear().toString().slice(-2) + 
                         String(new Date().getMonth() + 1).padStart(2, '0') +
                         String(new Date().getDate()).padStart(2, '0');
        informacionDetectada.numeroDeActa = `CEyS-${codigoFecha}`;
    }

    return informacionDetectada;
}

// ============================================================================
// FUNCIÓN PARA GENERAR ACTA CON GEMINI - Mi parte favorita del proyecto!
// ============================================================================

async function generarActaConInteligenciaArtificial(textoTranscrito, informacion) {
    if (!GeneradorActasConIA) {
        console.log("ℹ️  No hay generador de actas disponible");
        return null;
    }

    try {
        const generador = new GeneradorActasConIA();
        await generador.init();

        const resultadoActa = await generador.generarActa(textoTranscrito, {
            nombreBase: informacion.nombreDelProyecto || "acta",
            programa: informacion.programaAcademico,
            ficha: informacion.numeroFicha,
            fecha: informacion.fechaDeHoy,
            aprendiz: informacion.nombreAprendiz
        });

        if (resultadoActa) {
            console.log(`✅ Acta generada con ${modoGenerador.toUpperCase()}: ${resultadoActa.archivo}`);
            return {
                archivoGenerado: resultadoActa.archivo,
                textoCompleto: resultadoActa.texto
            };
        } else {
            console.log("❌ No se pudo generar el acta");
            return null;
        }
    } catch (error) {
        console.error(`❌ Error al generar el acta (${modoGenerador}):`, error.message);
        return null;
    }
}

// ============================================================================
// FUNCIONES ORIGINALES DEL TRANSCRIPTOR - Las adapté para mi proyecto
// ============================================================================

function buscarArchivosDeAudioProcesado() {
    if (!fs.existsSync(carpetaAudioProcesado)) {
        console.error(`❌ No encontré la carpeta: ${carpetaAudioProcesado}`);
        console.log("💡 Primero necesito ejecutar el preprocesador de audio");
        return [];
    }

    const todosLosArchivos = fs.readdirSync(carpetaAudioProcesado);
    const archivosDeParte = todosLosArchivos
        .filter(archivo => archivo.includes("_parte_") && archivo.endsWith(".wav"))
        .sort();

    return archivosDeParte.map(archivo => ({
        nombreArchivo: archivo,
        rutaCompleta: path.join(carpetaAudioProcesado, archivo),
        numeroParte: archivo.match(/_parte_(\d+)/)[1]
    }));
}

async function transcribirUnaParte(archivoParteInfo) {
    console.log(`🔊 Transcribiendo ${archivoParteInfo.nombreArchivo}...`);

            const comandoParaEjecutar = `python "${scriptPythonTranscribir}" "${archivoParteInfo.rutaCompleta}"`;

    try {
        const { stdout, stderr } = await execAsync(comandoParaEjecutar, {
            maxBuffer: 1024 * 1024 * 10,
            cwd: directorioDelProyecto
        });

            if (stderr && !stderr.includes('Lightning automatically upgraded')) {
            console.warn(`⚠️ Advertencias en ${archivoParteInfo.nombreArchivo}:`, stderr);
        }

           if (stderr && stderr.includes('Lightning automatically upgraded')) {
            console.log(`📦 PyTorch Lightning se actualizó automáticamente para ${archivoParteInfo.nombreArchivo}`);
        }

            console.log(stdout);

        const nombreBase = path.basename(archivoParteInfo.rutaCompleta, path.extname(archivoParteInfo.rutaCompleta));
        const archivoTranscripcionEsperado = path.join(path.dirname(archivoParteInfo.rutaCompleta), `${nombreBase}_transcripcion.txt`);

        if (!fs.existsSync(archivoTranscripcionEsperado)) {
            throw new Error(`No encontré la transcripción: ${archivoTranscripcionEsperado}`);
        }

        return {
            parte: archivoParteInfo.numeroParte,
            archivo: archivoTranscripcionEsperado,
            contenido: fs.readFileSync(archivoTranscripcionEsperado, "utf-8")
        };
    } catch (error) {
        if (error.stderr && !String(error.stderr).includes('Lightning automatically upgraded')) {
            console.error(`❌ Error transcribiendo ${archivoParteInfo.nombreArchivo}:`, error.message);
            console.error(`❌ Errores adicionales:`, error.stderr);
            if (error.stdout) {
                console.error(`❌ Salida:`, error.stdout);
            }
        }
        throw error;
    }
}

// Función para normalizar hablantes entre partes 
function unificarHablantesEntreParts(listaTranscripciones) {
    console.log("🧠 Unificando hablantes entre todas las partes...");
    
    const mapeoHablantesGlobal = {};
    let contadorDeHablantes = 1;
    
    const transcripcionesUnificadas = listaTranscripciones.map((transcripcion, indice) => {
        let textoUnificado = transcripcion.contenido;
        const numeroParteActual = indice + 1;
        
        // Encuentro todos los hablantes únicos en esta parte
        const hablantesEnEstaParte = [...new Set([...textoUnificado.matchAll(/INTERVIENE HABLANTE (SPEAKER_\d+|\d+):/g)].map(m => m[1]))];
        
        // Los mapeo a IDs globales
        hablantesEnEstaParte.forEach(hablanteLocal => {
            const claveMapeo = `PARTE_${numeroParteActual}_${hablanteLocal}`;
            
            if (!mapeoHablantesGlobal[claveMapeo]) {
                mapeoHablantesGlobal[claveMapeo] = contadorDeHablantes;
                console.log(`   ${hablanteLocal} (Parte ${numeroParteActual}) → HABLANTE ${contadorDeHablantes}`);
                contadorDeHablantes++;
            }
            
            // Reemplazo en el texto
            const expresionRegular = new RegExp(`INTERVIENE HABLANTE ${hablanteLocal}:`, 'g');
            textoUnificado = textoUnificado.replace(expresionRegular, `INTERVIENE HABLANTE ${mapeoHablantesGlobal[claveMapeo]}:`);
        });
        
        return {
            ...transcripcion,
            contenido: textoUnificado
        };
    });
    
    return transcripcionesUnificadas;
}

function combinarTodasLasTranscripciones(transcripciones) {
    console.log("🔗 Combinando todas las transcripciones en una sola...");
    
    const transcripcionesUnificadas = unificarHablantesEntreParts(transcripciones);
    transcripcionesUnificadas.sort((a, b) => parseInt(a.parte) - parseInt(b.parte));
    
    let textoFinalCompleto = "";
    const hablantesQueEncontre = new Set();
    
    transcripcionesUnificadas.forEach((transcripcion, indice) => {
        if (indice > 0) {
            textoFinalCompleto += "\n\n\n--- CONTINUACIÓN PARTE " + transcripcion.parte + " ---\n\n\n";
        }
        
        textoFinalCompleto += transcripcion.contenido;
        
        const hablantesEnEstaParte = [...transcripcion.contenido.matchAll(/INTERVIENE HABLANTE (\d+):/g)].map(m => m[1]);
        hablantesEnEstaParte.forEach(h => hablantesQueEncontre.add(h));
    });
    
    console.log("✅ Transcripciones combinadas exitosamente");
    console.log(`👥 Hablantes únicos que identifiqué: ${Array.from(hablantesQueEncontre).sort((a, b) => parseInt(a) - parseInt(b)).map(h => `HABLANTE ${h}`).join(", ")}`);
    
    return {
        textoCompleto: textoFinalCompleto,
        listaHablantes: Array.from(hablantesQueEncontre)
    };
}

function verificarSiHablantesEstanRegistrados(hablantesDetectados) {
    const mapeoExistente = fs.existsSync(archivoHablantes)
        ? JSON.parse(fs.readFileSync(archivoHablantes, "utf-8"))
        : {};

    const hablantesNoRegistrados = hablantesDetectados.filter(h => !mapeoExistente[`HABLANTE_${h}`] && !mapeoExistente[`HABLANTE ${h}`]);

    if (hablantesNoRegistrados.length > 0) {
        console.warn("\n⚠️ ¡Atención! Hay hablantes que no están en mi archivo 'hablantes.json':");
        hablantesNoRegistrados.forEach(h => console.warn(`  - HABLANTE ${h}`));
        console.warn("✏️  Necesito editar 'hablantes.json' y volver a ejecutar para generar el acta final.");
        return false;
    }
    
    return true;
}

// Variante que elimina las **negritas** antes de crear el documento Word
function limpiarMarkdown(texto) {
    if (!texto) return texto;
    let limpio = texto;                                   // inicio con el texto completo
    limpio = limpio.replace(/__(.*?)__/g, '$1');          // elimino __dobles__
    limpio = limpio.replace(/_(.*?)_/g, '$1');            // elimino _cursivas_
    limpio = limpio.replace(/\*\*([\s\S]+?)\*\*/g, '$1');  // elimina **negritas**
    limpio = limpio.replace(/^[*-]\s+/gm, '');           // elimino guiones o asteriscos iniciales
    limpio = limpio.replace(/(\d+\.\s[^\n]+)\n(?=\d+\.\s)/g, '$1\n\n'); // separo párrafos numerados

    return limpio;
}

function generarDocumentoWord(textoCompleto, nombreDelArchivo, datosExtras = {}) {
    if (!fs.existsSync(archivoPlantillaWord)) {
        console.error("❌ No encontré la plantilla de Word.");
        return false;
    }

    try {
        const datosPlantilla = fs.readFileSync(archivoPlantillaWord, "binary");
        const zip = new PizZip(datosPlantilla);
        const documentoWord = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: { start: "[[", end: "]]" }
        });

        const textoLimpio = limpiarMarkdown(textoCompleto);
        const participantesTexto = limpiarMarkdown(
            Array.isArray(datosExtras.participantes)
                ? datosExtras.participantes.join('\n')
                : (datosExtras.participantes || '')
        );

        const compromisosArray = Array.isArray(datosExtras.compromisos)
            ? datosExtras.compromisos : [];

        documentoWord.render({
            DESARROLLO: textoLimpio,
            FECHA: datosExtras.fecha || '',
            HORA_INICIO: datosExtras.horaInicio || '',
            HORA_FIN: datosExtras.horaFin || '',
            PARTICIPANTES: participantesTexto,
            OBJETIVOS: limpiarMarkdown(datosExtras.objetivos || ''),
            HECHOS: limpiarMarkdown(datosExtras.hechos || ''),
            DESARROLLO_COMITE: limpiarMarkdown(datosExtras.desarrolloComite || ''),
            CONCLUSIONES: limpiarMarkdown(datosExtras.conclusiones || ''),
            COMPROMISOS: compromisosArray
        });

        const bufferDocumento = documentoWord.getZip().generate({ type: "nodebuffer" });
        // Guardo en el directorio raíz
        const rutaDocumentoFinal = path.join(directorioDelProyecto, `${nombreDelArchivo}_acta_completa.docx`);
        fs.writeFileSync(rutaDocumentoFinal, bufferDocumento);
        
        console.log(`✅ ¡Logré generar el documento Word! Se guardó como: ${nombreDelArchivo}_acta_completa.docx`);
        return true;
    } catch (error) {
        console.error("❌ Tuve problemas generando el documento Word:", error);
        return false;
    }
}

// ============================================================================
// FUNCIÓN PRINCIPAL PARA TRANSCRIBIR MÚLTIPLES PARTES
// ============================================================================

async function transcribirAudioCompletoPorPartes() {
    try {
        console.log("🎬 INICIANDO SISTEMA DE TRANSCRIPCIÓN");
        console.log("=" .repeat(70));
        console.log("🔄 Modo automático: voy a procesar todas las partes de audio");
        
        // Muestro el estado de Gemini
        if (puedeUsarGemini) {
            console.log("🤖 Gemini AI: ✅ CONFIGURADO (¡qué emocionante!)");
        } else {
            console.log("🤖 Gemini AI: ❌ NO CONFIGURADO");
            console.log("💡 Para configurarlo necesito agregar GEMINI_API_KEY en .env");
        }
        console.log("");
        
        const archivosParaProcesar = buscarArchivosDeAudioProcesado();
        
        if (archivosParaProcesar.length === 0) {
            console.error("❌ No encontré archivos de audio procesados.");
            console.log("💡 Primero necesito ejecutar el preprocesador de audio");
            return;
        }
        
        console.log(`📋 Encontré ${archivosParaProcesar.length} partes para transcribir:`);
        archivosParaProcesar.forEach(parte => {
            console.log(`   - Parte ${parte.numeroParte}: ${parte.nombreArchivo}`);
        });
        console.log("");

        // Transcribo cada parte
        const transcripcionesCompletadas = [];
        const tiempoDeInicio = Date.now();
        
        for (const archivoParte of archivosParaProcesar) {
            try {
                console.log(`\n📝 PROCESANDO PARTE ${archivoParte.numeroParte}/${archivosParaProcesar.length}`);
                console.log(`${'='.repeat(50)}`);
                
                const tiempoParteInicio = Date.now();
                const transcripcionRealizada = await transcribirUnaParte(archivoParte);
                const tiempoQueTomo = (Date.now() - tiempoParteInicio) / 1000;
                
                transcripcionesCompletadas.push(transcripcionRealizada);
                console.log(`✅ Parte ${transcripcionRealizada.parte} completada en ${tiempoQueTomo.toFixed(1)}s`);
                
            } catch (error) {
                console.error(`❌ Tuve problemas con la parte ${archivoParte.numeroParte}:`, error.message);
            }
        }

        console.log(`\n🎉 ¡TRANSCRIPCIÓN COMPLETADA!`);
        console.log(`${'='.repeat(50)}`);

        if (transcripcionesCompletadas.length === 0) {
            console.error("❌ No pude transcribir ninguna parte. Algo salió mal.");
            return;
        }

        // Combino las transcripciones
        console.log("🔗 Combinando y organizando todas las transcripciones...");
        const resultadoCombinado = combinarTodasLasTranscripciones(transcripcionesCompletadas);
        
        // Detecto metadatos
        const nombreDelProyecto = "ADSO"; // Puedo cambiarlo según el audio
        const informacionExtraida = extraerInformacionDelAudio(nombreDelProyecto, resultadoCombinado.textoCompleto);
        
        // Guardo la transcripción completa en el directorio raíz
        const archivoTranscripcionCompleta = path.join(directorioDelProyecto, `${nombreDelProyecto}_transcripcion_completa.txt`);
        fs.writeFileSync(archivoTranscripcionCompleta, resultadoCombinado.textoCompleto, "utf-8");
        console.log(`📝 Transcripción completa guardada en: ${archivoTranscripcionCompleta}`);

        // Intento generar el acta con Gemini
        let resultadoActaConIA = null;
        if (puedeUsarGemini) {
            resultadoActaConIA = await generarActaConInteligenciaArtificial(resultadoCombinado.textoCompleto, informacionExtraida);
        }

        // Verifico los hablantes para el documento Word
        console.log(`👥 Hablantes que detecté: ${resultadoCombinado.listaHablantes.sort((a, b) => parseInt(a) - parseInt(b)).map(h => `HABLANTE ${h}`).join(", ")}`);
        const hablantesEstanOK = verificarSiHablantesEstanRegistrados(resultadoCombinado.listaHablantes);

        // Genero el documento Word si todo está bien
        if (hablantesEstanOK) {
            console.log("📄 Generando documento Word...");
            generarDocumentoWord(resultadoCombinado.textoCompleto, nombreDelProyecto, {});
        }

        // Muestro el resumen final
        const tiempoTotalEnMinutos = (Date.now() - tiempoDeInicio) / 1000 / 60;
        console.log(`\n📊 RESUMEN DE MI TRABAJO:`);
        console.log(`${'='.repeat(50)}`);
        console.log(`⏱️  Tiempo total: ${tiempoTotalEnMinutos.toFixed(1)} minutos`);
        console.log(`📝 Partes procesadas: ${transcripcionesCompletadas.length}/${archivosParaProcesar.length}`);
        console.log(`👥 Hablantes encontrados: ${resultadoCombinado.listaHablantes.length}`);
        console.log(`📄 Transcripción: ${archivoTranscripcionCompleta}`);
        
        if (resultadoActaConIA) {
            console.log(`🤖 Acta con Gemini: ${resultadoActaConIA.archivoGenerado}`);
        }
        
        if (hablantesEstanOK) {
            console.log(`📄 Documento Word: ${nombreDelProyecto}_acta_completa.docx`);
        }

        console.log(`\n🎯 ¡PROCESO COMPLETADO EXITOSAMENTE!`);
        console.log("Este fue mi proyecto de prácticas - ¡estoy orgulloso del resultado!");
        
        // Sugiero próximos pasos
        console.log(`\n📋 Próximos pasos que puedo hacer:`);
        if (!resultadoActaConIA && GeneradorActasConIA) {
            console.log(`   🤖 Generar acta manualmente: node generar_acta.js ${archivoTranscripcionCompleta}`);
        }
        if (!puedeUsarGemini) {
            console.log(`   ⚙️  Configurar Gemini para actas automáticas`);
        }
        console.log(`   ✏️  Gestionar nombres de hablantes: python src/python/gestionar_nombres.py`);
        console.log(`   📄 Revisar todos los archivos generados`);

    } catch (error) {
        console.error("❌ Tuve un error en mi proceso:", error.message);
    }
}

// ============================================================================
// FUNCIÓN PARA PROCESAR UN SOLO ARCHIVO DE AUDIO
// ============================================================================

async function transcribirUnSoloArchivo(rutaDelAudio) {
    // Verifico si la ruta es absoluta o relativa
    const rutaCompletaDelAudio = path.isAbsolute(rutaDelAudio) ? rutaDelAudio : path.resolve(directorioDelProyecto, rutaDelAudio);
    
    if (!fs.existsSync(rutaCompletaDelAudio)) {
        console.error(`❌ No encontré el archivo de audio: ${rutaCompletaDelAudio}`);
        return;
    }

    const nombreDelArchivo = path.basename(rutaCompletaDelAudio, path.extname(rutaCompletaDelAudio));
    const carpetaDelArchivo = path.dirname(rutaCompletaDelAudio);
    const archivoTranscripcionEsperado = path.join(carpetaDelArchivo, `${nombreDelArchivo}_transcripcion.txt`);

    console.log("🔊 TRANSCRIBIENDO UN ARCHIVO INDIVIDUAL");
    console.log(`${'='.repeat(50)}`);
    console.log(`📁 Archivo: ${rutaCompletaDelAudio}`);
    console.log(`📄 Transcripción se guardará en: ${archivoTranscripcionEsperado}`);
    
    const tiempoDeInicio = Date.now();
    
    const comandoCompleto = `python "${scriptPythonTranscribir}" "${rutaCompletaDelAudio}"`;

            try {
        const { stdout, stderr } = await execAsync(comandoCompleto, {
            maxBuffer: 1024 * 1024 * 10,
            cwd: directorioDelProyecto
        });

            if (stderr && !stderr.includes('Lightning automatically upgraded')) {
            console.warn("⚠️ Algunas advertencias:", stderr);
        }

        console.log(stdout);

        const posiblesUbicaciones = [
            archivoTranscripcionEsperado,
            path.join(directorioDelProyecto, `${nombreDelArchivo}_transcripcion.txt`),
            path.join(carpetaDelArchivo, `${nombreDelArchivo}_transcripcion.txt`)
        ];

            let archivoEncontrado = null;
        for (const ubicacion of posiblesUbicaciones) {
            if (fs.existsSync(ubicacion)) {
                archivoEncontrado = ubicacion;
                break;
            }
        }

            if (!archivoEncontrado) {
            console.error(`❌ No encontré el archivo de transcripción`);
            console.error(`❌ Busqué en estas ubicaciones:`);
            posiblesUbicaciones.forEach(ubicacion => {
                console.error(`   - ${ubicacion}`);
            });
            throw new Error(`No se encontró la transcripción`);
        }

             console.log(`✅ ¡Encontré la transcripción! Está en: ${archivoEncontrado}`);

        const textoTranscrito = fs.readFileSync(archivoEncontrado, "utf-8");
        const hablantesQueDetecte = Array.from(new Set([...textoTranscrito.matchAll(/HABLANTE (\w+|\d+)/g)].map(m => m[1])));

        const tiempoTotalSegundos = (Date.now() - tiempoDeInicio) / 1000;
        console.log(`\n🎉 ¡TRANSCRIPCIÓN INDIVIDUAL COMPLETADA!`);
        console.log(`⏱️ Me tomó: ${(tiempoTotalSegundos / 60).toFixed(1)} minutos`);
        console.log(`👥 Detecté ${hablantesQueDetecte.length} hablantes diferentes`);

        const informacionDelAudio = extraerInformacionDelAudio(nombreDelArchivo, textoTranscrito);
        let resultadoActa = null;

        if (puedeUsarGemini) {
            resultadoActa = await generarActaConInteligenciaArtificial(textoTranscrito, informacionDelAudio);
        }

        if (verificarSiHablantesEstanRegistrados(hablantesQueDetecte) && generarDocumentoWord(textoTranscrito, nombreDelArchivo, {})) {
            console.log(`✅ ¡Completé el procesamiento de: ${nombreDelArchivo}!`);
            console.log(`📄 Archivos que generé:`);
            console.log(`   - Transcripción: ${archivoEncontrado}`);
            console.log(`   - Documento Word: ${nombreDelArchivo}_acta_completa.docx`);

            if (resultadoActa) {
                console.log(`   - Acta con Gemini: ${resultadoActa.archivoGenerado}`);
            }
         }

        return {
            transcripcion: archivoEncontrado,
            acta: resultadoActa,
            informacion: informacionDelAudio
        };
    } catch (e) {
        console.error("❌ Tuve problemas procesando los archivos:", e);
        throw e;
    }
}

// ============================================================================
// LÓGICA PRINCIPAL - Aquí decido qué hacer según cómo me ejecuten
// ============================================================================

// Esta parte la aprendí viendo ejemplos en Stack Overflow
if (require.main === module) {
    console.log("🎓 SISTEMA DE TRANSCRIPCIÓN PARA PRÁCTICAS SENA");
    console.log("Desarrollado por un estudiante en formación");
    console.log("=" .repeat(60));
    
    if (process.argv.length > 2) {
        // Modo individual: me pasaron un archivo específico
        const archivoDeAudio = process.argv[2];
        console.log(`📁 Voy a procesar el archivo: ${archivoDeAudio}`);
        
        transcribirUnSoloArchivo(archivoDeAudio).catch(error => {
            console.error("❌ Algo salió mal en el procesamiento individual:", error.message);
            console.log("😔 No te preocupes, esto es parte del aprendizaje. Revisaré qué pasó.");
            process.exit(1);
        });
    } else {
        // Modo por partes: procesamiento completo
        console.log("🔄 Modo automático: voy a procesar todas las partes de audio");
        transcribirAudioCompletoPorPartes();
    }
}

// Exporto las funciones para que otros archivos las puedan usar
module.exports = {
    transcribirAudioCompletoPorPartes,
    transcribirUnSoloArchivo,
    extraerInformacionDelAudio,
    generarActaConInteligenciaArtificial,
    combinarTodasLasTranscripciones,
    generarDocumentoWord
};