const fs = require('fs');
const path = require('path');
const { GeneradorActas } = require('./generar_acta');
const { generarDocumentoWord } = require('./transcribir');

async function generarActaEnDosPartes(parte1, parte2 = null, info = {}) {
    const textos = [];
    if (parte1) textos.push(fs.readFileSync(parte1, 'utf8'));
    if (parte2) textos.push(fs.readFileSync(parte2, 'utf8'));
    const textoCompleto = textos.join('\n\n');

    const generador = new GeneradorActas();
    await generador.init();
    const resultado = await generador.generarActaEnDosPartes(textoCompleto, info);

    if (resultado) {
        generarDocumentoWord(resultado.textoDelActa, info.nombreDelProyecto, {
            fecha: resultado.fecha,
            horaInicio: resultado.horaInicio,
            horaFin: resultado.horaFin,
            participantes: resultado.participantes
        });

        const projectRoot = path.resolve(__dirname, '../../');
        const docxName = `${info.nombreDelProyecto}_acta_completa.docx`;
        const docxOrigen = path.join(projectRoot, docxName);
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
        const [parte1, parte2] = process.argv.slice(2);
       if (!parte1) {
            console.error('Uso: node generar_acta_en_partes.js PARTE1 [PARTE2]');
            process.exit(1);
        }

        const nombreProyecto = path.basename(parte1).replace('_transcripcion', '').replace(path.extname(parte1), '');
        const info = { nombreDelProyecto: nombreProyecto };

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