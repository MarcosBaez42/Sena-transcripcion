// Generador de Actas para Comités SENA
// Este es mi proyecto final de prácticas - Sistema automatizado para generar actas
// Me emociona mucho haber logrado integrar IA para automatizar este proceso
// Autor: Estudiante en práctica - ADSO (Análisis y Desarrollo de Software)

const fs = require("fs");
const path = require("path");

// Cargo las variables de entorno 
require('dotenv').config();

// Esta es mi clase principal 
class GeneradorDeActasSENA {
    constructor() {
        this.miClaveAPI = process.env.GEMINI_API_KEY;
        this.modeloIA = null;
        this.reglamento = {};
    }

    async init() {
        await this.configurarConexionConGemini();
        this.cargarReglamento();
        return true;
    }

    cargarReglamento() {
        const ruta = path.join(__dirname, '../../config/reglamento.json');
        try {
            if (fs.existsSync(ruta)) {
                const data = fs.readFileSync(ruta, 'utf-8');
                this.reglamento = JSON.parse(data).articulos || {};
                console.log(`📚 Reglamento del Aprendiz cargado (${Object.keys(this.reglamento).length} artículos)`);
            } else {
                console.log('ℹ️ No encontré config/reglamento.json');
            }
        } catch (e) {
            console.error('⚠️ No pude cargar el reglamento:', e.message);
            this.reglamento = {};
        }
    }

    obtenerTextoReglamento(codigos = []) {
        if (!Array.isArray(codigos) || codigos.length === 0) return '';
        return codigos.map(c => {
            const texto = this.reglamento[c];
            return texto ? `- ${c}: ${texto}` : '';
        }).filter(Boolean).join('\n');
    }

    async configurarConexionConGemini() {
        try {
            // Importo la librería de Google (me costó entender cómo usarla al principio)
            const { GoogleGenerativeAI } = require("@google/generative-ai");
            this.clienteGemini = new GoogleGenerativeAI(this.miClaveAPI);

            // Uso el modelo que configuré en las variables de entorno
            const modeloQueVoyAUsar = process.env.MODELO_GEMINI || 'gemini-2.5-flash';

            this.modeloIA = this.clienteGemini.getGenerativeModel({
                model: modeloQueVoyAUsar,
                generationConfig: {
                    temperature: parseFloat(process.env.TEMPERATURA) || 0.3,  // No muy creativo, más formal
                    topK: 20,
                    topP: 0.8,
                    maxOutputTokens: parseInt(process.env.MAX_TOKENS) || 4900,
                }
            });
            console.log(`✅ ¡Logré conectar con Gemini! Usando modelo: ${modeloQueVoyAUsar}`);
            return true;
        } catch (error) {
            console.error("❌ Tuve problemas configurando Gemini:", error.message);
            console.log("💡 Necesito instalar: npm install @google/generative-ai");
            console.log("💡 Y configurar mi GEMINI_API_KEY en el archivo .env");
            throw error;
        }
    }

    obtenerPlantillaDelActa() {
        // Esta plantilla la hice basándome en las actas reales que vi en el SENA
        return `Eres un asistente experto en redactar actas formales del Comité de Evaluación y Seguimiento del SENA.

Debes generar un acta **siguiendo exactamente esta estructura y formato**.

---

# ACTA No. [NÚMERO]
## COMITÉ DE EVALUACIÓN Y SEGUIMIENTO

**CIUDAD Y FECHA:** [Extraer de transcripción]  
**HORA INICIO:** [Extraer o estimar]  
**HORA FIN:** [Calcular]  
**LUGAR:** [Virtual/Presencial o extraer]

---

## AGENDA O PUNTOS PARA DESARROLLAR:
**1. Saludo** 
**2. Verificación del Quórum** 
**3. Hechos que serán objeto de estudio en el Comité** 
**4. Instalación del Comité por parte del Coordinador Académico** 
**5. Desarrollo del Comité/ Análisis del Caso, descargos del aprendiz y practica de pruebas a que haya lugar.**
**6. Análisis y conclusiones realizadas por el Comité.**

---

## OBJETIVO(S) DE LA REUNIÓN:
Analizar el caso del aprendiz [Extraer de transcripción] DEL PROGRAMA [Extraer de transcripción] FICHA: [Extraer de transcripción]  

---

## DESARROLLO DE LA REUNIÓN

### 1. SALUDO
Se da inicio con el saludo de bienvenida.

### 2. VERIFICACIÓN DEL QUÓRUM
Verificada la asistencia y existiendo quórum para sesionar y decidir, se da inicio al comité y se procede de conformidad al orden del día.

## PARTICIPANTES
- **COORDINACIÓN ACADÉMICA:** [Nombre y cargo]
- **BIENESTAR DEL APRENDIZ:** [Nombre y cargo]
- **INSTRUCTORES:** [Lista de instructores]
- **APRENDIZ CITADO:** [Nombre del aprendiz]
- **REPRESENTANTE DE CENTRO:** [Nombre]
- **VOCERO:** [Nombre]

### 3. HECHOS QUE SERÁN OBJETO DE ESTUDIO EN EL COMITÉ
[Enumera cada hecho con números consecutivos. Extrae con claridad los hechos reportados por los instructores, mencionando fechas, fallas y evidencias. Por ejemplo: "1) El día 13 de diciembre del 2024 el aprendiz falla la prueba de conocimiento por segunda vez, teniendo en cuenta que previamente se había asignado una actividad complementaria. etc."].

Se indica la preocupación acerca del tema, el cual radica en que se evidencia incumplimiento del REGLAMENTO DEL APRENDIZ: en el [Cita el artículo exacto del reglamento del aprendiz que describa el incumplimiento Por ejemplo: CAPITULO III DEBERES DEL APRENDIZ SENA; Artículo 22º Deberes del aprendiz, en su numeral cita: Numeral 6 Cumplir con todas las actividades de aprendizaje propias de su proceso formativo, presentando las evidencias según la planeación pedagógica, guías de aprendizaje y cronograma, en los plazos o en la oportunidad que estas deban presentarse o reportarse, a través de los medios dispuestos para ello Numeral 7. Realizar una dedicación efectiva del tiempo, priorizando las actividades de aprendizaje y manteniendo un compromiso constante para alcanzar los resultados de aprendizaje propuestos en el programa de formación.]

Hechos Instructor(a) [Nombre del instructor]:

El aprendiz [Nombre del aprendiz], (agregar numero de CC o TI) se reporta a comité de tipo [Tipo de comité, por ejemplo: "academico", "disciplinario", etc.] 
Instructor(a): [Cargo y nombre del instructor]: [extrae los hechos reportados por el instructor, incluyendo fechas, fallas y evidencias. Por ejemplo: "El aprendiz no participó en las actividades de socialización, no subió evidencias al drive, no participó en exposiciones ni en actividades de bienestar del aprendiz."]

Se indica la preocupación acerca del tema, el cual radica en que se evidencia incumplimiento del REGLAMENTO DEL APRENDIZ: en el [Cita el artículo exacto del reglamento del aprendiz que describa el incumplimiento Por ejemplo: "CAPITULO III DEBERES DEL APRENDIZ SENA; Articulo No.9 Deberes del aprendiz, en su numeral 4, el cual cita: Participar en las actividades complementarias o de profundización, relacionadas con el programa de formación, con el fin de gestionar su proceso de aprendizaje."]

Por lo anterior y respetando el debido proceso, se cita al aprendiz [Nombre del aprendiz] del programa [extraer programa y numero de la ficha. Por ejemplo: "TECNICO DE ASISTECIA ADMINISTRATIVA FICHA 3065626"]. para la presentación de sus descargos ante el Comité de Evaluación y Seguimiento, respetando el derecho que le asiste a controvertir las pruebas allegadas o que se alleguen en su contra y a aportar y/o solicitar la práctica de las pruebas que considere pertinentes.

### 4. INSTALACIÓN DEL COMITÉ POR PARTE DEL COORDINADOR
El coordinador JOHON FREDY SANABRIA MUÑOZ da un saludo de bienvenida a los presentes en el comité. El Comité de Evaluación y Seguimiento es una instancia académica fundamental en nuestra institución. Su propósito principal es orientar y apoyar de manera integral el proceso de formación de nuestros aprendices, asegurando que se lleve a cabo con los más altos estándares de calidad. Este comité desempeña un papel fundamental al analizar y evaluar de manera constante los programas de estudio, los métodos pedagógicos y los resultados obtenidos. Además, se encarga de proponer mejoras, ajustes y estrategias que contribuyan a optimizar la experiencia educativa de nuestros aprendices. Nuestro objetivo común es formar profesionales competentes, éticos y comprometidos con su desarrollo personal y con la sociedad. A través del trabajo conjunto del Comité de Evaluación y Seguimiento, podremos garantizar que estamos cumpliendo con nuestra misión de ofrecer una educación de calidad.

### 5. DESARROLLO DEL COMITÉ / ANALISIS DEL CASO, DESCARGOS DEL APRENDIZ Y PRÁCTICA DE PRUEBAS A QUE HAYA LUGAR
[Intervenciones de los participantes comieza con Interviene [Cargo y nombre], extrae y resume lo mas relevante dicho por los participantes, extrae los puntos tratados análisis del caso, descargos del aprendiz, pruebas realizadas y cualquier otro detalle relevante.]

### 6. CONCLUSIONES
[Resume lo mas que se pueda el tipo de falta, gravedad, medidas, planes de mejoramiento.]

---

## COMPROMISOS Y SEGUIMIENTO

| Actividad/Decisión | Fecha Límite | Responsable |
|-------------------|--------------|-------------|
| [Compromiso 1]     | [Fecha]      | [Nombre]    |
| [Compromiso 2]     | [Fecha]      | [Nombre]    |

---

De acuerdo con La Ley 1581 de 2012, Protección de Datos Personales, el Servicio Nacional de Aprendizaje SENA, se compromete a garantizar la seguridad y protección de los datos personales que se encuentran almacenados en este documento, y les dará el tratamiento correspondiente en cumplimiento de lo establecido legalmente.

## INSTRUCCIONES ADICIONALES:
- Usa **tercera persona** y lenguaje formal.
- **No inventes contenido** si no está en la transcripción.
- Usa **"No especificado en transcripción"** si falta algún dato.
- Respeta **el orden y títulos exactos** del formato.
- Usa Markdown correctamente (títulos con #, negritas con **).
- si en las intervenciones no reconoces el nombre de un participante, revisa los nombres de los participantes en la sección de participantes y utiliza el nombre que creas que corresponde teniendo en cuenta lo que esta dicendo el texto.
- resume las intervenciones de los participantes, no copies textualmente lo que dicen, extrae lo mas relevante de cada intervención.
- resume las conclusiones de forma clara y concisa, no copies textualmente lo que dicen los participantes.

Ahora redacta el acta en formato Markdown con base en la siguiente transcripción.`;
    }

    // Función para crear las carpetas donde guardo mis actas
    crearCarpetaParaElProyecto(nombreDelProyecto, esVersionFinal = false) {
        const carpetaPrincipal = esVersionFinal ? 'actas_gemini/finales' : 'actas_gemini/versiones';
        const nombreLimpio = nombreDelProyecto.replace(/_transcripcion.*$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
        const rutaCarpetaCompleta = path.join(carpetaPrincipal, nombreLimpio);
        
        if (!fs.existsSync(rutaCarpetaCompleta)) {
            fs.mkdirSync(rutaCarpetaCompleta, { recursive: true });
            console.log(`📁 Creé la carpeta: ${rutaCarpetaCompleta}`);
        }
        
        return rutaCarpetaCompleta;
    }

    // Extraigo metadatos básicos del acta en formato Markdown
    extraerMetadatosDelActa(textoActa) {
        const obtener = (regex) => {
            const m = textoActa.match(regex);
            return m ? m[1].trim() : null;
        };

        const limpiar = (v) => v ? v.replace(/\*+/g, '').trim() : v;

        const fecha = limpiar(obtener(/CIUDAD Y FECHA:\s*([^\n]+)/i));
        const horaInicio = limpiar(obtener(/HORA INICIO:\s*([^\n]+)/i));
        const horaFin = limpiar(obtener(/HORA FIN:\s*([^\n]+)/i));

        let participantes = [];
        const seccionPartes = textoActa.split(/##\s*PARTICIPANTES/i)[1];
        if (seccionPartes) {
            for (const linea of seccionPartes.split(/\r?\n/)) {
                const recorte = linea.trim();
                if (recorte.startsWith('##')) break;
                if (recorte.startsWith('-')) {
                    participantes.push(recorte.replace(/^-+\s*/, '').replace(/\*+/g, '').trim());
                }
            }
        }

        const obtenerSeccion = (regex) => {
            const partes = textoActa.split(regex);
            if (partes.length < 2) return null;
            return partes[1].split(/\n###\s*\d+\./)[0].trim();
        };

        const hechos = obtenerSeccion(/###\s*3\.?[^\n]*HECHOS[^\n]*/i);
        const desarrolloComite = obtenerSeccion(/###\s*5\.?[^\n]*DESARROLLO[^\n]*/i);
        const conclusiones = obtenerSeccion(/###\s*6\.?[^\n]*CONCLUSIONES[^\n]*/i);

        return { fecha, horaInicio, horaFin, participantes, hechos, desarrolloComite, conclusiones };
    }

    async generarMiActa(textoTranscripcion, informacionExtra = {}) {
        if (!this.modeloIA) {
            console.error("❌ No tengo Gemini configurado. Necesito verificar mi API key.");
            return null;
        }

        console.log("🤖 Generando acta con mi sistema de IA...");

        const textoReducido = textoTranscripcion.length > 4900
    ? textoTranscripcion.slice(0, 4900) + "\n[...transcripción truncada por longitud...]"
    : textoTranscripcion;

        const articulos = this.obtenerTextoReglamento(informacionExtra.articulosReglamento);
        const promptCompleto = `${this.obtenerPlantillaDelActa()}

TRANSCRIPCIÓN DEL COMITÉ QUE NECESITO PROCESAR:
${textoReducido}

INFORMACIÓN ADICIONAL QUE DETECTÉ:
- Programa Académico: ${informacionExtra.programaAcademico || 'Técnico en Asistencia Administrativa'}
- Número de Ficha: ${informacionExtra.numeroFicha || 'Por determinar'}
- Fecha del Comité: ${informacionExtra.fechaDeHoy || new Date().toLocaleDateString('es-CO')}
- Aprendiz Principal: ${informacionExtra.nombreAprendiz || 'Extraer de la transcripción'}
${articulos ? `\nNORMATIVA APLICABLE:\n${articulos}\n` : ''}

Por favor ayúdame a generar el acta formal completa siguiendo exactamente el formato que necesito.`;

        try {
            const resultadoDeGemini = await this.modeloIA.generateContent(promptCompleto);
            const respuestaObtenida = await resultadoDeGemini.response;
            
            if (!respuestaObtenida) {
                throw new Error("Gemini no me respondió nada");
            }

            const actaGenerada = respuestaObtenida.text();
            
            // Creo la carpeta específica para este proyecto
            const nombreProyecto = informacionExtra.nombreDelProyecto || 'acta_comite';
            const carpetaDelProyecto = this.crearCarpetaParaElProyecto(nombreProyecto, informacionExtra.esVersionFinal);
            
            // Genero el nombre del archivo
            const fechaHoy = new Date().toISOString().split('T')[0];
            const nombreDelArchivo = informacionExtra.esVersionFinal ? 
                `${nombreProyecto}_final.md` : 
                `${nombreProyecto}_${fechaHoy}.md`;
            
            const rutaCompletaDelActa = path.join(carpetaDelProyecto, nombreDelArchivo);
            
            fs.writeFileSync(rutaCompletaDelActa, actaGenerada, 'utf-8');
            
            console.log(`✅ ¡Logré generar el acta! Se guardó en: ${rutaCompletaDelActa}`);
            console.log(`📄 Tamaño del acta: ${actaGenerada.length} caracteres`);
            
            const metadatos = this.extraerMetadatosDelActa(actaGenerada);

            return {
                textoDelActa: actaGenerada,
                archivo: rutaCompletaDelActa,
                carpetaDelProyecto: carpetaDelProyecto,
                ...metadatos
            };

        } catch (error) {
            console.error("❌ Tuve un problema generando el acta:", error.message);
            
            // Diagnostico qué pudo haber pasado (esto me ayuda a aprender)
            if (error.message.includes('API_KEY')) {
                console.log("💡 Parece que hay un problema con mi API Key de Gemini.");
            } else if (error.message.includes('quota')) {
                console.log("💡 Llegué al límite de uso de la API. Intentaré más tarde.");
            } else if (error.message.includes('model')) {
                console.log("💡 Hay un problema con el modelo que estoy usando.");
            }
            
            return null;
        }
    }
    
    async generarActaEnDosPartes(textoTranscripcion, informacionExtra = {}) {
        if (!this.modeloIA) {
            console.error("❌ No tengo Gemini configurado. Necesito verificar mi API key.");
            return null;
        }

        console.log("🤖 Generando acta en dos llamadas a Gemini...");

        const articulos = this.obtenerTextoReglamento(informacionExtra.articulosReglamento);
        const promptBase = `${this.obtenerPlantillaDelActa()}

TRANSCRIPCIÓN DEL COMITÉ QUE NECESITO PROCESAR:
${textoTranscripcion}

INFORMACIÓN ADICIONAL QUE DETECTÉ:
- Programa Académico: ${informacionExtra.programaAcademico || 'Técnico en Asistencia Administrativa'}
- Número de Ficha: ${informacionExtra.numeroFicha || 'Por determinar'}
- Fecha del Comité: ${informacionExtra.fechaDeHoy || new Date().toLocaleDateString('es-CO')}
- Aprendiz Principal: ${informacionExtra.nombreAprendiz || 'Extraer de la transcripción'}
${articulos ? `\nNORMATIVA APLICABLE:\n${articulos}\n` : ''}

Por favor escribe la primera mitad del acta. Finaliza con la etiqueta <<CONTINUAR>> si falta texto.`;

        try {
            const chat = this.modeloIA.startChat();
            const primeraParte = await chat.sendMessage(promptBase);
            const textoPrimera = (await primeraParte.response).text();

            const segundaParte = await chat.sendMessage("Continúa la redacción del acta justo donde quedó la etiqueta <<CONTINUAR>> y termina el documento.");
            const textoSegunda = (await segundaParte.response).text();

            const actaFinal = (textoPrimera.replace('<<CONTINUAR>>', '') + '\n' + textoSegunda).trim();

            const nombreProyecto = informacionExtra.nombreDelProyecto || 'acta_comite';
            const carpetaDelProyecto = this.crearCarpetaParaElProyecto(nombreProyecto, informacionExtra.esVersionFinal);
            const fechaHoy = new Date().toISOString().split('T')[0];
            const nombreDelArchivo = informacionExtra.esVersionFinal ?
                `${nombreProyecto}_final.md` :
                `${nombreProyecto}_${fechaHoy}.md`;

            const rutaCompletaDelActa = path.join(carpetaDelProyecto, nombreDelArchivo);
            fs.writeFileSync(rutaCompletaDelActa, actaFinal, 'utf-8');

            console.log(`✅ ¡Acta generada en dos partes! Se guardó en: ${rutaCompletaDelActa}`);
            console.log(`📄 Tamaño del acta final: ${actaFinal.length} caracteres`);
            
            const metadatos = this.extraerMetadatosDelActa(actaFinal);

            return {
                textoDelActa: actaFinal,
                archivo: rutaCompletaDelActa,
                carpetaDelProyecto: carpetaDelProyecto,
                ...metadatos
            };
        } catch (error) {
            console.error("❌ Ocurrió un problema en la generación por partes:", error.message);
            return null;
        }
    }

    async generarVariasVersionesDelActa(textoTranscripcion, informacionExtra = {}, numeroDeVersiones = 2) {
        console.log(`🔄 Voy a generar ${numeroDeVersiones} versiones diferentes del acta para elegir la mejor...`);
        
        const versionesGeneradas = [];
        
        for (let i = 1; i <= numeroDeVersiones; i++) {
            console.log(`📝 Generando versión ${i} de ${numeroDeVersiones}...`);
            
            const informacionParaEstaVersion = {
                ...informacionExtra,
                nombreDelProyecto: `${informacionExtra.nombreDelProyecto || 'acta'}_version_${i}`,
                esVersionFinal: false
            };
            
            const resultadoDeEstaVersion = await this.generarMiActa(textoTranscripcion, informacionParaEstaVersion);
            
            if (resultadoDeEstaVersion) {
                versionesGeneradas.push({
                    numeroVersion: i,
                    archivoGenerado: resultadoDeEstaVersion.archivo,
                    textoCompleto: resultadoDeEstaVersion.textoDelActa
                });
            }
            
            // Pauso un poco entre versiones para no saturar la API
            if (i < numeroDeVersiones) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`✅ Logré generar ${versionesGeneradas.length} versiones del acta`);
        return versionesGeneradas;
    }

    analizarCalidadDeLasVersiones(listaDeVersiones) {
        console.log("🔍 Analizando qué versión quedó mejor...");
        
        const analisisDeVersiones = listaDeVersiones.map(version => {
            const texto = version.textoCompleto;
            
            return {
                numeroVersion: version.numeroVersion,
                archivoGenerado: version.archivoGenerado,
                estadisticas: {
                    longitud: texto.length,
                    numeroSecciones: (texto.match(/#{1,3}/g) || []).length,
                    participantesEncontrados: (texto.match(/\*\*[A-Z\s]+:\*\*/g) || []).length,
                    fechasEncontradas: (texto.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{1,2} de \w+ de \d{4}/g) || []).length,
                    tieneConclusiones: texto.includes('CONCLUSIONES') ? 1 : 0,
                    tieneCompromisos: texto.includes('COMPROMISOS') ? 1 : 0
                }
            };
        });
        
        console.log("📊 Estadísticas de cada versión:");
        analisisDeVersiones.forEach(analisis => {
            console.log(`   Versión ${analisis.numeroVersion}:`);
            console.log(`     - Extensión: ${analisis.estadisticas.longitud} caracteres`);
            console.log(`     - Secciones: ${analisis.estadisticas.numeroSecciones}`);
            console.log(`     - Participantes: ${analisis.estadisticas.participantesEncontrados}`);
            console.log(`     - Fechas: ${analisis.estadisticas.fechasEncontradas}`);
            console.log(`     - Está completa: ${analisis.estadisticas.tieneConclusiones && analisis.estadisticas.tieneCompromisos ? '✅' : '❌'}`);
        });
        
        // Elijo la mejor versión basándome en completitud
        const mejorVersion = analisisDeVersiones.reduce((mejor, actual) => {
            const puntajeMejor = mejor.estadisticas.numeroSecciones + mejor.estadisticas.participantesEncontrados + 
                               mejor.estadisticas.tieneConclusiones + mejor.estadisticas.tieneCompromisos;
            const puntajeActual = actual.estadisticas.numeroSecciones + actual.estadisticas.participantesEncontrados + 
                                actual.estadisticas.tieneConclusiones + actual.estadisticas.tieneCompromisos;
            
            return puntajeActual > puntajeMejor ? actual : mejor;
        });
        
        console.log(`🏆 La mejor versión es: Versión ${mejorVersion.numeroVersion} (${path.basename(mejorVersion.archivoGenerado)})`);
        
        return mejorVersion;
    }

    async crearVersionFinalDelActa(mejorVersion, informacionExtra) {
        try {
            const nombreProyecto = informacionExtra.nombreDelProyecto || 'acta';
            const carpetaFinales = this.crearCarpetaParaElProyecto(nombreProyecto, true);
            
            const nombreArchivoFinal = `${nombreProyecto}_final.md`;
            const rutaArchivoFinal = path.join(carpetaFinales, nombreArchivoFinal);
            
            fs.copyFileSync(mejorVersion.archivoGenerado, rutaArchivoFinal);
            
            console.log(`🎯 ¡Creé la versión final! Se guardó en: ${rutaArchivoFinal}`);
            
            return rutaArchivoFinal;
        } catch (error) {
            console.log(`❌ Tuve problemas creando la versión final: ${error.message}`);
            return null;
        }
    }
}

// Esta es mi función principal que uso desde otros archivos
async function procesarTranscripcionParaGenerarActa(archivoDeTranscripcion, informacionExtra = {}) {
    try {
        // Verifico que el archivo existe
        if (!fs.existsSync(archivoDeTranscripcion)) {
            console.error(`❌ No encontré el archivo: ${archivoDeTranscripcion}`);
            return false;
        }

        // Leo la transcripción
        const textoTranscrito = fs.readFileSync(archivoDeTranscripcion, 'utf-8');
        
        if (textoTranscrito.length < 100) {
            console.error("❌ La transcripción está muy corta para generar un acta decente");
            return false;
        }

        console.log(`📝 Procesando: ${path.basename(archivoDeTranscripcion)}`);
        console.log(`📏 Tamaño de la transcripción: ${textoTranscrito.length} caracteres`);

        // Creo mi generador de actas
        const miGenerador = new GeneradorDeActasSENA();
        
        // Inicializo la conexión con Gemini
        await miGenerador.init();

        // Extraigo información básica del nombre del archivo
        const nombreBase = path.basename(archivoDeTranscripcion, path.extname(archivoDeTranscripcion));
        const informacionCompleta = {
            nombreDelProyecto: nombreBase.replace('_transcripcion', ''),
            fechaDeHoy: new Date().toLocaleDateString('es-CO'),
            ...informacionExtra
        };

        // Detecto información automáticamente de la transcripción
        const programaDetectado = textoTranscrito.match(/programa\s+([^.]+)/i);
        const fichaDetectada = textoTranscrito.match(/ficha\s*:?\s*(\d+)/i);
        const aprendizDetectado = textoTranscrito.match(/aprendiz\s+([A-Z\s]+)/i);

        if (programaDetectado) informacionCompleta.programaAcademico = programaDetectado[1].trim();
        if (fichaDetectada) informacionCompleta.numeroFicha = fichaDetectada[1];
        if (aprendizDetectado) informacionCompleta.nombreAprendiz = aprendizDetectado[1].trim();

        // Genero varias versiones del acta
        const versionesGeneradas = await miGenerador.generarVariasVersionesDelActa(
            textoTranscrito, 
            informacionCompleta, 
            2  // Genero 2 versiones para comparar
        );

        if (versionesGeneradas.length > 0) {
            // Analizo cuál versión quedó mejor
            const mejorVersion = miGenerador.analizarCalidadDeLasVersiones(versionesGeneradas);
            
            // Creo la versión final
            const archivoFinal = await miGenerador.crearVersionFinalDelActa(mejorVersion, informacionCompleta);
            
            console.log(`\n🎉 ¡COMPLETÉ MI PROCESO DE GENERACIÓN DE ACTAS!`);
            console.log(`📄 Acta final: ${archivoFinal}`);
            console.log(`📁 Versiones generadas: ${versionesGeneradas.length}`);
            console.log("¡Estoy muy orgulloso de este resultado!");
            
            return {
                archivoFinal: archivoFinal,
                versiones: versionesGeneradas,
                mejorVersion: mejorVersion
            };
        } else {
            console.error("❌ No logré generar ninguna versión del acta");
            return false;
        }

    } catch (error) {
        console.error("❌ Tuve un error en mi procesamiento:", error.message);
        return false;
    }
}

// Función para buscar transcripciones automáticamente en mi directorio
async function buscarYProcesarTodasLasTranscripciones() {
    console.log("🔗 Buscando transcripciones que pueda procesar...");
    
    // Busco archivos de transcripción en mi directorio
    const archivosDeTranscripcion = fs.readdirSync('.')
        .filter(archivo => archivo.includes('_transcripcion.txt'))
        .sort();

    if (archivosDeTranscripcion.length === 0) {
        console.log("ℹ️  No encontré transcripciones. Primero necesito ejecutar el transcriptor.");
        return;
    }

    console.log(`📋 Encontré ${archivosDeTranscripcion.length} transcripciones:`);
    archivosDeTranscripcion.forEach((archivo, i) => {
        console.log(`   ${i + 1}. ${archivo}`);
    });

    // Proceso cada transcripción
    for (const archivo of archivosDeTranscripcion) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`🎯 PROCESANDO: ${archivo}`);
        console.log(`${'='.repeat(60)}`);
        
        const resultado = await procesarTranscripcionParaGenerarActa(archivo);
        
        if (resultado) {
            console.log(`✅ ${archivo} → ${path.basename(resultado.archivoFinal)}`);
        } else {
            console.log(`❌ Tuve problemas procesando ${archivo}`);
        }
        
        // Pauso entre archivos para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}

// Exporto mis funciones para que otros archivos las puedan usar
module.exports = {
    GeneradorActas: GeneradorDeActasSENA,  // Mantengo el nombre original para compatibilidad
    procesarTranscripcionConGemini: procesarTranscripcionParaGenerarActa,  // Alias para compatibilidad
    integrarConTranscriptor: buscarYProcesarTodasLasTranscripciones
};

// Esta parte se ejecuta cuando llamo al archivo directamente
if (require.main === module) {
    console.log("🎓 GENERADOR DE ACTAS - PROYECTO DE PRÁCTICAS SENA");
    console.log("Desarrollado por un estudiante en formación");
    console.log("¡Espero que funcione bien!");
    console.log("=" .repeat(60));
    
    // Verifico los argumentos que me pasaron
    if (process.argv.length > 2) {
        // Modo específico: procesar un archivo específico
        const archivoEspecifico = process.argv[2];
        const extraArg = process.argv.find(a => a.startsWith('--articulos='));
        const articulos = extraArg ? extraArg.replace('--articulos=', '').split(',').map(a => a.trim()) : [];
        console.log(`📁 Voy a procesar específicamente: ${archivoEspecifico}`);
        procesarTranscripcionParaGenerarActa(archivoEspecifico, { articulosReglamento: articulos });
    } else {
        // Modo automático: procesar todas las transcripciones que encuentre
        console.log("🔄 Modo automático: voy a procesar todas las transcripciones");
        buscarYProcesarTodasLasTranscripciones();
    }
}