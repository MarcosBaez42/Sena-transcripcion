const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function transcribirUnaParte(archivoParteInfo, scriptPythonTranscribir, directorioDelProyecto, pythonExtraArgs = []) {
    console.log(`🔊 Transcribiendo ${archivoParteInfo.nombreArchivo}...`);

    try {
        await new Promise((resolve, reject) => {
            const child = spawn('python', [scriptPythonTranscribir, archivoParteInfo.rutaCompleta, ...pythonExtraArgs], {
                cwd: directorioDelProyecto,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            child.stdout.pipe(process.stdout);
            child.stderr.pipe(process.stderr);

            child.on('close', code => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`transcribir.py exited with code ${code}`));
                }
            });
            child.on('error', reject);
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