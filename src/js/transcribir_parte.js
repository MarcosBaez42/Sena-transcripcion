const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function transcribirUnaParte(archivoParteInfo, scriptPythonTranscribir, directorioDelProyecto, argumentosExtraPython = []) {
    console.log(`🔊 Transcribiendo ${archivoParteInfo.nombreArchivo}...`);

    try {
        await new Promise((resolver, rechazar) => {
            const subproceso = spawn('python', [scriptPythonTranscribir, archivoParteInfo.rutaCompleta, ...argumentosExtraPython], {
                cwd: directorioDelProyecto,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            subproceso.stdout.pipe(process.stdout);
            subproceso.stderr.pipe(process.stderr);

            subproceso.on('close', codigo => {
                if (codigo === 0) {
                    resolver();
                } else {
                    rechazar(new Error(`transcribir.py terminó con código ${codigo}`));
                }
            });
            subproceso.on('error', rechazar);
        });

        const nombreBase = path.basename(archivoParteInfo.rutaCompleta, path.extname(archivoParteInfo.rutaCompleta));
        const archivoTranscripcionEsperado = path.join(path.dirname(archivoParteInfo.rutaCompleta), `${nombreBase}_transcripcion.txt`);

        if (!fs.existsSync(archivoTranscripcionEsperado)) {
            throw new Error(`No encontré la transcripción: ${archivoTranscripcionEsperado}`);
        }

        return {
            parte: archivoParteInfo.numeroParte,
            archivo: archivoTranscripcionEsperado,
            contenido: fs.readFileSync(archivoTranscripcionEsperado, 'utf-8')
        };
    } catch (error) {
        console.error(`❌ Error transcribiendo ${archivoParteInfo.nombreArchivo}:`, error.message);
        throw error;
    }
}

module.exports = { transcribirUnaParte };