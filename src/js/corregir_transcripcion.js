// Corrige ortografía y gramática de una transcripción
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function corregirTranscripcion(inputPath, outputPath, modelo) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY no configurada');

    const client = new GoogleGenerativeAI(apiKey);
    const modelName = modelo || process.env.MODELO_GEMINI || 'gemini-2.5-flash';
    const modelInstance = client.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: parseFloat(process.env.TEMPERATURA) || 0.3,
            topK: 20,
            topP: 0.8,
            maxOutputTokens: parseInt(process.env.MAX_TOKENS) || 4900,
        }
    });

    const texto = fs.readFileSync(inputPath, 'utf8');
    const chunkWords = parseInt(process.env.CHUNK_WORDS) || 1500;
    const palabras = texto.split(/\s+/);
    const partes = [];
    for (let i = 0; i < palabras.length; i += chunkWords) {
        partes.push(palabras.slice(i, i + chunkWords).join(' '));
    }

    let resultadoCompleto = '';
    for (const parte of partes) {
        const prompt = "Corrige la gramatica del texto no le adiciones nada solo corrige " + parte;
        
        const res = await modelInstance.generateContent(prompt);
        const resp = await res.response;
        resultadoCompleto += resp.text() + '\n';
    }

    fs.writeFileSync(outputPath, resultadoCompleto, 'utf8');
    console.log(`✅ Transcripción corregida guardada en: ${outputPath}`);
}

if (require.main === module) {
    const input = process.argv[2];
    if (!input) {
        console.error('Uso: node src/js/corregir_transcripcion.js archivo.txt [salida.txt] [modeloGemini]');
        process.exit(1);
    }
    const output = process.argv[3] || path.join(path.dirname(input), path.basename(input, path.extname(input)) + '_corregida.txt');
    const modelo = process.argv[4];
    corregirTranscripcion(input, output, modelo).catch(err => {
        console.error('❌ Error al corregir transcripción:', err.message);
    });
}

module.exports = { corregirTranscripcion };