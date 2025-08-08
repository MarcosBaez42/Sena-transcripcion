# Script de Transcripción para el SENA

import sys
import time
import io
import json
import os
import warnings
import re
import builtins
import torch

# Modo silencioso (--quiet o variable QUIET_MODE)
QUIET_MODE = os.getenv("QUIET_MODE", "").lower() not in ("", "0", "false", "no")
if "--quiet" in sys.argv:
    QUIET_MODE = True
    sys.argv.remove("--quiet")

if QUIET_MODE:
    builtins.print = lambda *a, **k: None

# Token de Hugging Face desde variable de entorno
token_hf = os.getenv("HF_TOKEN")
if not token_hf:
    print("⚠️  Variable HF_TOKEN no configurada; la diarización no se ejecutará.")
    print("💡  Configura tu token con: export HF_TOKEN=tu_token_de_huggingface")

# Configuración para que funcione bien en Windows 
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# Importo las librerías que necesito para el proyecto
try:
    import whisperx
    from whisperx.diarize import DiarizationPipeline
    import torch
except ImportError as e:
    print(f"❌ Me faltan librerías: {e}")
    print("💡 Instala con: pip install whisperx")
    sys.exit(1)

    # Parámetros configurables
BATCH_SIZE_DEF = 8
COMPUTE_TYPE_DEF = "float16"
TIPOS_PERMITIDOS = {"float16", "float32", "int8", "int8_float16", "int8_float32"}

tamano_lote = BATCH_SIZE_DEF
tipo_computo = COMPUTE_TYPE_DEF

def validar_batch_size(valor):
    try:
        v = int(valor)
        if v > 0:
            return v
    except (TypeError, ValueError):
        pass
    print(f"⚠️ Valor inválido para batch size: {valor}. Usando {BATCH_SIZE_DEF}.")
    return BATCH_SIZE_DEF

def validar_tipo_computo(valor):
    if valor in TIPOS_PERMITIDOS:
        return valor
    print(f"⚠️ Valor inválido para compute type: {valor}. Usando {COMPUTE_TYPE_DEF}.")
    return COMPUTE_TYPE_DEF

# Variables de entorno
env_batch = os.getenv("BATCH_SIZE")
env_compute = os.getenv("COMPUTE_TYPE")
if env_batch:
    tamano_lote = validar_batch_size(env_batch)
if env_compute:
    tipo_computo = validar_tipo_computo(env_compute)

# Argumentos por línea de comandos
if "--batch-size" in sys.argv:
    idx = sys.argv.index("--batch-size")
    val = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
    tamano_lote = validar_batch_size(val)
    del sys.argv[idx:idx + 2]

if "--compute-type" in sys.argv:
    idx = sys.argv.index("--compute-type")
    val = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else None
    tipo_computo = validar_tipo_computo(val)
    del sys.argv[idx:idx + 2]

def seleccionar_dispositivo():
    dispositivo_env = os.getenv("DEVICE")
    dispositivo_cli = None
    if "--device" in sys.argv:
        idx = sys.argv.index("--device")
        if idx + 1 < len(sys.argv):
            dispositivo_cli = sys.argv[idx + 1].lower()
            del sys.argv[idx:idx + 2]
        else:
            print("⚠️ Debes indicar un dispositivo después de --device")
            del sys.argv[idx]
    if dispositivo_cli:
        return dispositivo_cli
    if dispositivo_env:
        return dispositivo_env.lower()
    return "cuda" if torch.cuda.is_available() else "cpu"

dispositivo = seleccionar_dispositivo()


if len(sys.argv) < 2:
    print("❌ ¡Necesito que me digas qué archivo transcribir!")
    print("💡 Uso: python transcribir.py archivo_de_audio.mp3")
    sys.exit(1)

archivo_de_audio = sys.argv[1]
nombre_sin_extension = archivo_de_audio.rsplit(".", 1)[0]
 
if not os.path.exists(archivo_de_audio):
    print(f"❌ No encontré el archivo: {archivo_de_audio}")
    print("💡 Verifica que el nombre y la ruta estén correctos")
    sys.exit(1)

print(f"📁 ¡Perfecto! Encontré el archivo: {archivo_de_audio}")
print("🤖 Cargando el modelo WhisperX...")
print("⏳ Esto puede tardar un poco la primera vez...")

tipo_computo = "float16" if dispositivo == "cuda" else "int8"
if dispositivo == "cuda":
    torch.backends.cudnn.benchmark = True
    torch.set_float32_matmul_precision("high")

modelo_whisper = whisperx.load_model("medium", dispositivo, compute_type=tipo_computo)
print("✅ Modelo cargado correctamente")

print(f"🎙️ Comenzando transcripción de: {archivo_de_audio}")
tiempo_inicio = time.time()

try:
    try:
        resultado_transcripcion = modelo_whisper.transcribe(
            archivo_de_audio, 
            language="es",  
            batch_size=tamano_lote,
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
            logprob_threshold=-1.0,
            compression_ratio_threshold=2.4,
            temperature=0.0
        )
        print("✅ Transcripción avanzada completada")
    except TypeError as e:
        print(f"⚠️ Parámetros avanzados no funcionaron: {e}")
        print("🔄 Intentando con parámetros básicos...")
        try:
            resultado_transcripcion = modelo_whisper.transcribe(archivo_de_audio, language="es", batch_size=tamano_lote)
            print("✅ Transcripción básica completada")
        except TypeError:
            resultado_transcripcion = modelo_whisper.transcribe(archivo_de_audio, language="es")
            print("✅ Transcripción mínima completada")
    
except Exception as e:
    print(f"❌ Error durante la transcripción: {e}")
    print("😔 Algo salió mal, pero no te preocupes, revisaré qué pasó")
    sys.exit(1)

print("🔤 Alineando palabras para mayor precisión...")
try:
    modelo_alineacion, metadatos = whisperx.load_align_model(language_code="es", device=dispositivo)
    resultado_alineado = whisperx.align(resultado_transcripcion["segments"], modelo_alineacion, metadatos, archivo_de_audio, dispositivo)
    print("✅ Alineación completada correctamente")
except Exception as e:
    print(f"⚠️ Problemas con la alineación: {e}")
    print("🔄 Continuando sin alineación precisa...")
    resultado_alineado = resultado_transcripcion

segmentos_hablantes = None
if token_hf:
    print("👥 Aplicando separación de hablantes...")
    try:
        pipeline_diarizacion = DiarizationPipeline(use_auth_token=token_hf, device=dispositivo)
        print(f"🖥️ Diarización usando dispositivo: {dispositivo}")
        segmentos_hablantes = pipeline_diarizacion(archivo_de_audio)
        resultado_alineado = whisperx.assign_word_speakers(segmentos_hablantes, resultado_alineado)

        for segment in resultado_alineado.get("segments", []):
            speakers = [word.get("speaker") for word in segment.get("words", []) if word.get("speaker")]

            if speakers:
                segment["speaker"] = max(set(speakers), key=speakers.count)
            else:
                segment["speaker"] = "DESCONOCIDO"

        print("✅ Separación de hablantes completada")
    except Exception as e:
        print(f"⚠️ Problemas con la diarización: {e}")
        print("🔄 Continuando sin separación de hablantes...")
else:
    print("⚠️  Se omitirá la diarización porque HF_TOKEN no está configurado.")
    print("💡  Establece la variable de entorno HF_TOKEN para habilitar la separación de hablantes.")

archivo_nombres = "hablantes.json"
try:
    with open(archivo_nombres, "r", encoding="utf-8") as f:
        mapeo_nombres = json.load(f)
except FileNotFoundError:
    mapeo_nombres = {}
    print(f"ℹ️ No encontré {archivo_nombres}, crearé uno nuevo")

# Sistema para mantener consistencia de hablantes entre diferentes audios
archivo_mapeo_global = "mapeo_hablantes_global.json"
try:
    with open(archivo_mapeo_global, "r", encoding="utf-8") as f:
        hablantes_globales = json.load(f)
        contador_global = max([int(h.split('_')[1]) for h in hablantes_globales.values() if h.startswith('HABLANTE_')], default=0) + 1
except FileNotFoundError:
    hablantes_globales = {}
    contador_global = 1
    print(f"ℹ️ Creando nuevo sistema de mapeo de hablantes")

def asignar_hablante_global(speaker_local):
    """Esta función mantiene consistencia en los nombres de hablantes"""
    global contador_global
    
    if not speaker_local or speaker_local == "DESCONOCIDO":
        return "DESCONOCIDO"
    
    if speaker_local in hablantes_globales:
        return hablantes_globales[speaker_local]
    else:
        nuevo_hablante = f"HABLANTE_{contador_global}"
        hablantes_globales[speaker_local] = nuevo_hablante
        contador_global += 1
        
        print(f"🆕 Nuevo hablante detectado: {speaker_local} → {nuevo_hablante}")
        
        # Guardo el mapeo actualizado
        try:
            with open(archivo_mapeo_global, "w", encoding="utf-8") as f:
                json.dump(hablantes_globales, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"⚠️ No pude guardar el mapeo: {e}")
        
        return nuevo_hablante

def obtener_nombre_final(hablante_global):
    """Obtiene el nombre final del hablante para mostrar"""
    if not hablante_global or hablante_global == "DESCONOCIDO":
        return "HABLANTE DESCONOCIDO"
    
    if hablante_global in mapeo_nombres:
        return mapeo_nombres[hablante_global]
    
    try:
        if '_' in hablante_global:
            numero = hablante_global.split('_')[1]
            return f"HABLANTE {numero}"
        else:
            return f"HABLANTE {hablante_global}"
    except (IndexError, ValueError):
        return f"HABLANTE {hablante_global}"

def limpiar_texto_repetitivo(texto):
    """Limpia repeticiones molestas en el texto transcrito"""
    # Elimino repeticiones excesivas de muletillas
    texto = re.sub(r'\b(no|sí|ah|eh|mm|um)\s*(?:\1\s*){4,}', r'\1 ', texto, flags=re.IGNORECASE)
    texto = re.sub(r'(?:no,?\s*){5,}', 'no ', texto, flags=re.IGNORECASE)
    texto = re.sub(r',\s*,\s*,+', ', ', texto)
    texto = re.sub(r'\s+', ' ', texto)
    
    return texto.strip()

def formatear_texto_final(texto_final):
    """Formatea el texto para que se vea profesional"""
    print("🎨 Aplicando formato final al texto...")
    
    patron = r'(INTERVIENE HABLANTE \w+:)'
    partes = re.split(patron, texto_final)
    
    texto_formateado = ""
    
    i = 0
    while i < len(partes):
        parte = partes[i].strip()
        
        if parte.startswith('INTERVIENE HABLANTE'):
            if i + 1 < len(partes):
                texto_intervencion = partes[i + 1].strip()
                
                texto_intervencion = re.sub(r'\s+', ' ', texto_intervencion)
                texto_intervencion = texto_intervencion.strip()
                
                if texto_formateado:
                    texto_formateado += "\n\n"
                
                texto_formateado += f"{parte} {texto_intervencion}"
                
                i += 2
            else:
                i += 1
        else:
            if parte and not parte.startswith('---'):
                if texto_formateado and not parte.startswith('INTERVIENE'):
                    texto_formateado += " " + parte
            elif parte.startswith('---'):
                texto_formateado += f"\n\n{parte}\n\n"
            
            i += 1
    
    return texto_formateado.strip()

def procesar_segmentos_con_hablantes(resultado_alineado):
    """Esta es mi función principal para procesar toda la transcripción"""

    segmentos = resultado_alineado["segments"] if isinstance(resultado_alineado, dict) else resultado_alineado

    print(f"🎯 Procesando {len(segmentos)} segmentos de audio...")

    # Primera pasada: asigno hablantes a cada segmento
    segmentos_procesados = []

    for i, seg in enumerate(segmentos):
        tiempo_inicio = seg.get("start", 0)
        tiempo_fin = seg.get("end", tiempo_inicio + 1)
        texto_segmento = seg.get("text", "").strip()

        if not texto_segmento or len(texto_segmento) < 1:
            continue

        texto_segmento = re.sub(r'\s+', ' ', texto_segmento.strip())

        hablante_local = seg.get("speaker") or "DESCONOCIDO"

        if hablante_local != "DESCONOCIDO":
            hablante_global = asignar_hablante_global(hablante_local)
        else:
            hablante_global = "DESCONOCIDO"

        segmentos_procesados.append({
            'indice': i,
            'tiempo': tiempo_inicio,
            'hablante': hablante_global,
            'texto': texto_segmento
        })
    
    # Segunda pasada: suavizo cambios bruscos de hablante 
    for i in range(len(segmentos_procesados)):
        seg_actual = segmentos_procesados[i]
        
        contexto_anterior = []
        contexto_posterior = []
        
        for j in range(max(0, i-3), i):
            if j < len(segmentos_procesados):
                contexto_anterior.append(segmentos_procesados[j]['hablante'])
        
        for j in range(i+1, min(len(segmentos_procesados), i+4)):
            contexto_posterior.append(segmentos_procesados[j]['hablante'])
        
        if (contexto_anterior and contexto_posterior and 
            seg_actual['hablante'] != "DESCONOCIDO"):
            
            hablante_anterior = max(set(contexto_anterior), key=contexto_anterior.count) if contexto_anterior else None
            hablante_posterior = max(set(contexto_posterior), key=contexto_posterior.count) if contexto_posterior else None
            
            if (hablante_anterior == hablante_posterior and 
                seg_actual['hablante'] != hablante_anterior and
                hablante_anterior is not None and 
                hablante_anterior != "DESCONOCIDO"):
                
                seg_actual['hablante'] = hablante_anterior
    
    # Tercera pasada: agrupo segmentos consecutivos del mismo hablante
    grupos = []
    grupo_actual = None
    
    for seg in segmentos_procesados:
        if grupo_actual is None:
            # Primer grupo
            grupo_actual = {
                'hablante': seg['hablante'],
                'textos': [seg['texto']],
                'tiempo_inicio': seg['tiempo'],
                'cantidad_segmentos': 1
            }
        elif seg['hablante'] == grupo_actual['hablante']:
            grupo_actual['textos'].append(seg['texto'])
            grupo_actual['cantidad_segmentos'] += 1
        else:
            grupos.append(grupo_actual)
            grupo_actual = {
                'hablante': seg['hablante'],
                'textos': [seg['texto']],
                'tiempo_inicio': seg['tiempo'],
                'cantidad_segmentos': 1
            }
    
    # Agrego el último grupo
    if grupo_actual:
        grupos.append(grupo_actual)
    
    texto_final = ""
    
    for i, grupo in enumerate(grupos):
        nombre_para_mostrar = obtener_nombre_final(grupo['hablante'])
        texto_del_grupo = " ".join(grupo['textos'])
        
        texto_del_grupo = limpiar_texto_repetitivo(texto_del_grupo)
        
        if len(texto_del_grupo) > 3:
            texto_final += f"INTERVIENE {nombre_para_mostrar}: {texto_del_grupo} "
    
    # Muestro estadísticas de mi trabajo
    total_segmentos_originales = len(segmentos_procesados)
    total_grupos_procesados = len(grupos)
    

    # Si no se generó texto con hablantes, uso método de respaldo
    if not texto_final.strip():
        print("⚠️ No se pudo asignar hablantes, usando método de respaldo...")
        texto_final = "INTERVIENE HABLANTE DESCONOCIDO: "
        
        for seg in segmentos:
            texto_seg = seg.get("text", "").strip()
            if texto_seg:
                texto_final += texto_seg + " "
    
    return texto_final.strip()


if segmentos_hablantes is not None:
    texto_transcrito_final = procesar_segmentos_con_hablantes(resultado_alineado)
else:
    print("📝 Sin separación de hablantes, procesando como hablante único...")
    texto_transcrito_final = "INTERVIENE HABLANTE DESCONOCIDO: "

    segmentos = resultado_alineado["segments"] if isinstance(resultado_alineado, dict) else resultado_alineado

    for seg in segmentos:
        texto_seg = seg.get("text", "").strip()

        if texto_seg:
            texto_seg = limpiar_texto_repetitivo(texto_seg)
            if texto_seg.strip():
                texto_transcrito_final += texto_seg + " "

# Limpio y formato el texto final
texto_transcrito_final = limpiar_texto_repetitivo(texto_transcrito_final)
texto_transcrito_final = formatear_texto_final(texto_transcrito_final)


# Guardo el resultado en un archivo
archivo_salida = f"{nombre_sin_extension}_transcripcion.txt"
with open(archivo_salida, "w", encoding="utf-8") as f:
    f.write(texto_transcrito_final)

try:
    del modelo_whisper
    if "pipeline_diarizacion" in locals():
        del pipeline_diarizacion
    torch.cuda.empty_cache()
except Exception:
    pass

tiempo_final = time.time()
print("✅ ¡Transcripción y separación de hablantes completadas!")
print(f"⏱️ Tiempo total: {round(tiempo_final - tiempo_inicio, 2)} segundos")
print(f"📄 Texto guardado en: {archivo_salida}")

# Muestro estadísticas de intervenciones
intervenciones_detectadas = [linea for linea in texto_transcrito_final.split('\n') if linea.strip().startswith('INTERVIENE')]
print(f"👥 Total de intervenciones detectadas: {len(intervenciones_detectadas)}")

print("\n🎉 ¡Proceso completado! Este fue mi aporte al proyecto del SENA.")