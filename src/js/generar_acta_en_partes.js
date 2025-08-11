const fs = require('fs');
const path = require('path');
const { GeneradorActas } = require('./generar_acta');
const { generarDocumentoWord } = require('./generador_documento');
const { extraerInformacionDelAudio } = require('./metadatos');

async function generarActaEnDosPartes(parte1, parte2 = null, info = {}) {
    const textos = [];
    if (parte1) textos.push(fs.readFileSync(parte1, 'utf8'));
    if (parte2) textos.push(fs.readFileSync(parte2, 'utf8'));
    const textoCompleto = textos.join('\n\n');

    const nombreBase = info.nombreDelProyecto || (parte1 ? path.basename(parte1).replace('_transcripcion', '').replace(path.extname(parte1), '') : 'acta');
    const infoDetectada = extraerInformacionDelAudio(nombreBase, textoCompleto);
    const infoFinal = { ...infoDetectada, ...info, nombreDelProyecto: nombreBase };

    const generador = new GeneradorActas();
    await generador.init();
    const resultado = await generador.generarActaEnDosPartes(textoCompleto, infoFinal);

    if (resultado) {
        const directorioDelProyecto = path.resolve(__dirname, '../../');
        const archivoPlantillaWord = path.join(directorioDelProyecto, 'config/plantilla.docx');

        generarDocumentoWord(resultado.textoDelActa, infoFinal.nombreDelProyecto, {
            fecha: resultado.fecha,
            horaInicio: resultado.horaInicio,
            horaFin: resultado.horaFin,
            participantes: resultado.participantes,
            objetivos: resultado.objetivos,
            hechos: resultado.hechos,
            desarrolloComite: resultado.desarrolloComite,
            conclusiones: resultado.conclusiones,
            compromisos: resultado.compromisos
        }, archivoPlantillaWord, directorioDelProyecto);

        const docxName = `${infoFinal.nombreDelProyecto}_acta_completa.docx`;
        const docxOrigen = path.join(directorioDelProyecto, docxName);
        const destino = path.join(path.dirname(resultado.archivo), docxName);

        try {
            fs.renameSync(docxOrigen, destino);
            resultado.archivoDocx = destino;
        } catch (err) {
            console.error(`No pude mover el archivo Word: ${err.message}`);
        }
    }

    return resultado;
}

if (require.main === module) {
    (async () => {
        const args = process.argv.slice(2);
        const archivos = [];
        const overrides = {};

        for (const arg of args) {
            if (arg.startsWith('--')) {
                const [flag, valor] = arg.split('=');
                if (!valor) continue;
                switch (flag) {
                    case '--fecha':
                        overrides.fechaDeHoy = valor;
                        break;
                    case '--programa':
                        overrides.programaAcademico = valor;
                        break;
                    case '--ficha':
                        overrides.numeroFicha = valor;
                        break;
                    case '--aprendiz':
                        overrides.nombreAprendiz = valor;
                        break;
                }
            } else {
                archivos.push(arg);
            }
        }

        const [parte1, parte2] = archivos;
        if (!parte1) {
            console.error('Uso: node generar_acta_en_partes.js PARTE1 [PARTE2] [--programa=.. --ficha=.. --fecha=.. --aprendiz=..]');
            process.exit(1);
        }

        const nombreProyecto = path.basename(parte1).replace('_transcripcion', '').replace(path.extname(parte1), '');
        const info = { nombreDelProyecto: nombreProyecto, ...overrides };

        const resultado = await generarActaEnDosPartes(parte1, parte2, info);
        if (resultado) {
            console.log(`Acta generada en: ${resultado.archivo}`);
            if (resultado.archivoDocx) {
                console.log(`Documento Word guardado en: ${resultado.archivoDocx}`);
            }
        } else {
            console.error('No se generó el acta.');
        }
    })();
}

module.exports = { generarActaEnDosPartes };