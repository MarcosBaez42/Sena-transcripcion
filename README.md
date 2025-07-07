# Sistema de Transcripción y Actas para Comités SENA

Este proyecto automatiza la transcripción de audio de reuniones del SENA y genera actas en formato Markdown/Word.

## Requisitos

- **Node.js** (recomendado v18 o superior)
- **Python** 3.10+
- Instalar dependencias:
  - `npm install`
  - `pip install -r requirements.txt`
- Configurar las siguientes variables de entorno en un archivo `.env`:
  - `GEMINI_API_KEY` – clave para usar Google Gemini.
  - `MODELO_GEMINI` – nombre del modelo Gemini (opcional).
  - `TEMPERATURA` – control de aleatoriedad para Gemini (opcional).
  - `MAX_TOKENS` – límite de tokens generados por Gemini (opcional).
  - `HF_TOKEN` – token de Hugging Face usado por el transcriptor en Python.

## Comandos principales

- `npm run transcribir` – procesa los audios y genera archivos de texto.
- `npm run generar-acta` – crea un acta a partir de una transcripción.
- `npm run generar-acta-partes` – acepta uno o dos archivos de transcripción y genera el acta completa.

## Carpeta `src`

- `src/js` contiene los scripts Node.js para transcribir y generar actas.
- `src/python` incluye el transcriptor avanzado con WhisperX.

Las actas generadas se almacenan en la carpeta `actas_gemini`.

### Asignar nombres de hablantes

Después de transcribir un audio puedes ejecutar:

```bash
python src/python/gestionar_nombres.py ruta/al/archivo_transcripcion.txt
```

El programa intentará detectar nombres propios cerca de cada etiqueta `INTERVIENE HABLANTE X:` usando spaCy y te sugerirá un nombre para cada hablante. Presiona **Enter** para aceptar la sugerencia o escribe el nombre correcto.
