const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const audioFile = "ADSO.mp3"; // Cambia por el nombre de tu archivo
const nombreBase = path.basename(audioFile, path.extname(audioFile));

// Configuración
const outputDir = "audio_procesado";
const audioLimpio = path.join(outputDir, `${nombreBase}_limpio.wav`);
const prefijoParte = path.join(outputDir, `${nombreBase}_parte`);

console.log("🎵 Iniciando preprocesamiento de audio...");

// Crear directorio de salida si no existe
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
    console.log(`📁 Directorio creado: ${outputDir}`);
}

// Función para obtener duración del audio
function obtenerDuracion(archivo) {
    return new Promise((resolve, reject) => {
        const comando = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${archivo}"`;
        exec(comando, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(parseFloat(stdout.trim()));
            }
        });
    });
}

// Función para limpiar audio (reducir ruido)
function limpiarAudio() {
    return new Promise((resolve, reject) => {
        console.log("🧹 Limpiando audio (reduciendo ruido de fondo)...");
        
        const filtros = [
            "highpass=f=80",           // Filtro pasa-altos a 80Hz
            "lowpass=f=8000",          // Filtro pasa-bajos a 8kHz
            "afftdn=nr=20:nf=-40",     // Reducción de ruido FFT
            "dynaudnorm=p=0.9:s=5"     // Normalización dinámica
        ].join(",");

        const comando = `ffmpeg -i "${audioFile}" -af "${filtros}" -ar 16000 -ac 1 "${audioLimpio}" -y`;
        
        console.log("⚙️  Aplicando filtros de limpieza...");
        exec(comando, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Error al limpiar audio:", error.message);
                reject(error);
            } else {
                console.log("✅ Audio limpiado correctamente");
                resolve();
            }
        });
    });
}

// Función para dividir audio en partes
function dividirAudio(duracionTotal) {
    return new Promise((resolve, reject) => {
        console.log("✂️  Dividiendo audio en 3 partes...");
        
        const duracionParte = duracionTotal / 3;
        const comandos = [];
        
        // Crear comandos para cada parte
        for (let i = 0; i < 3; i++) {
            const inicioTiempo = i * duracionParte;
            const archivoSalida = `${prefijoParte}_${i + 1}.wav`;
            
            const comando = `ffmpeg -i "${audioLimpio}" -ss ${inicioTiempo} -t ${duracionParte} -c copy "${archivoSalida}" -y`;
            comandos.push({
                comando: comando,
                parte: i + 1,
                archivo: archivoSalida,
                inicio: Math.floor(inicioTiempo / 60),
                duracion: Math.floor(duracionParte / 60)
            });
        }
        
        // Ejecutar comandos secuencialmente
        let procesoActual = 0;
        
        function procesarSiguiente() {
            if (procesoActual >= comandos.length) {
                resolve(comandos.map(c => c.archivo));
                return;
            }
            
            const cmd = comandos[procesoActual];
            console.log(`📝 Creando parte ${cmd.parte} (${cmd.inicio}min - ~${cmd.duracion}min)...`);
            
            exec(cmd.comando, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Error al crear parte ${cmd.parte}:`, error.message);
                    reject(error);
                } else {
                    console.log(`✅ Parte ${cmd.parte} creada: ${path.basename(cmd.archivo)}`);
                    procesoActual++;
                    procesarSiguiente();
                }
            });
        }
        
        procesarSiguiente();
    });
}

// Función principal
async function procesarAudio() {
    try {
        // Verificar que existe el archivo de audio
        if (!fs.existsSync(audioFile)) {
            console.error(`❌ No se encontró el archivo: ${audioFile}`);
            return;
        }

        // Verificar que ffmpeg está instalado
        console.log("🔍 Verificando ffmpeg...");
        await new Promise((resolve, reject) => {
            exec("ffmpeg -version", (error) => {
                if (error) {
                    console.error("❌ ffmpeg no está instalado o no está en el PATH");
                    console.log("📋 Para instalar ffmpeg:");
                    console.log("   Windows: Descargar de https://ffmpeg.org/download.html");
                    console.log("   macOS: brew install ffmpeg");
                    console.log("   Ubuntu/Debian: sudo apt install ffmpeg");
                    reject(error);
                } else {
                    resolve();
                }
            });
        });

        // Obtener duración del audio original
        console.log("⏱️  Obteniendo información del audio...");
        const duracion = await obtenerDuracion(audioFile);
        console.log(`📊 Duración total: ${Math.floor(duracion / 60)} minutos ${Math.floor(duracion % 60)} segundos`);

        // Limpiar audio
        await limpiarAudio();

        // Dividir audio en partes
        const archivosPartes = await dividirAudio(duracion);

        console.log("\n🎉 ¡Preprocesamiento completado!");
        console.log("📁 Archivos generados:");
        console.log(`   - Audio limpio: ${audioLimpio}`);
        archivosPartes.forEach((archivo, i) => {
            console.log(`   - Parte ${i + 1}: ${archivo}`);
        });
        
        console.log("\n📝 Siguiente paso:");
        console.log("   Ejecuta transcribir.js usando cada archivo de parte individual");
        console.log("   Ejemplo: node transcribir.js para cada archivo .wav generado");
        
        // Crear un archivo de lote para transcribir todas las partes
        const scriptTranscripcion = archivosPartes
            .map(archivo => `echo "Transcribiendo ${path.basename(archivo)}..."\nnode transcribir.js "${archivo}"`)
            .join("\n\n");
            
        const archivoLote = path.join(outputDir, "transcribir_todas_partes.bat");
        fs.writeFileSync(archivoLote, scriptTranscripcion);
        console.log(`📋 Script creado: ${archivoLote}`);

    } catch (error) {
        console.error("❌ Error durante el procesamiento:", error.message);
    }
}

// Ejecutar
procesarAudio();