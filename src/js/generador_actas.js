let GeneradorActasConIA;
let modoGenerador = null;
const puedeUsarGemini = Boolean(process.env.GEMINI_API_KEY);

try {
    if (puedeUsarGemini) {
        console.log('🤖 Gemini ✅ HABILITADO');
        const { GeneradorActas } = require('./generar_acta');
        GeneradorActasConIA = GeneradorActas;
        modoGenerador = 'gemini';
    } else {
        console.log('ℹ️  No hay modelo de IA configurado. Solo se hará transcripción.');
    }
} catch (error) {
    console.warn('⚠️  No se pudo cargar el generador de actas:', error.message);
}

async function generarActaConInteligenciaArtificial(textoTranscrito, informacion) {
    if (!GeneradorActasConIA) {
        console.log('ℹ️  No hay generador de actas disponible');
        return null;
    }

    try {
        const generador = new GeneradorActasConIA();
        await generador.init();

        const resultadoActa = await generador.generarMiActa(textoTranscrito, {
            nombreDelProyecto: informacion.nombreDelProyecto || 'acta',
            programaAcademico: informacion.programaAcademico,
            numeroFicha: informacion.numeroFicha,
            fechaDeHoy: informacion.fechaDeHoy,
            nombreAprendiz: informacion.nombreAprendiz
        });

        if (resultadoActa) {
            console.log(`✅ Acta generada con ${modoGenerador.toUpperCase()}: ${resultadoActa.archivo}`);
            return {
                archivoGenerado: resultadoActa.archivo,
                textoCompleto: resultadoActa.textoDelActa
            };
        } else {
            console.log('❌ No se pudo generar el acta');
            return null;
        }
    } catch (error) {
        console.error(`❌ Error al generar el acta (${modoGenerador}):`, error.message);
        return null;
    }
}

module.exports = { generarActaConInteligenciaArtificial, puedeUsarGemini };