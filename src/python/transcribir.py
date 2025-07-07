# Script de Transcripción para mis Prácticas en el SENA
# Este es mi proyecto para automatizar la transcripción de comités
# Me ha costado mucho trabajo pero al final funcionó!
# Autor: Estudiante en práctica - Técnico en Análisis y Desarrollo de Software

import sys
import time
import io
import json
import os
import warnings
import re

# Token de Hugging Face desde variable de entorno
token_hf = os.getenv("HF_TOKEN")

# Configuración para que funcione bien en Windows 
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Oculto las advertencias molestas 
warnings.filterwarnings("ignore", category=UserWarning)
warnings.filterwarnings("ignore", category=FutureWarning)

# Importo las librerías que necesito para el proyecto
try:
    import whisperx
    from whisperx.diarize import DiarizationPipeline
    import pandas as pd
except ImportError as e:
    print(f"❌ Me faltan librerías: {e}")
    print("💡 Instala con: pip install whisperx")
    sys.exit(1)

# Verifico que me hayan pasado el archivo de audio
if len(sys.argv) < 2:
    print("❌ ¡Necesito que me digas qué archivo transcribir!")
    print("💡 Uso: python transcribir.py archivo_de_audio.mp3")
    sys.exit(1)

archivo_de_audio = sys.argv[1]
nombre_sin_extension = archivo_de_audio.rsplit(".", 1)[0]

# Primero verifico que el archivo exista 
if not os.path.exists(archivo_de_audio):
    print(f"❌ No encontré el archivo: {archivo_de_audio}")
    print("💡 Verifica que el nombre y la ruta estén correctos")
    sys.exit(1)

print(f"📁 ¡Perfecto! Encontré el archivo: {archivo_de_audio}")
print("🤖 Cargando el modelo WhisperX...")
print("⏳ Esto puede tardar un poco la primera vez...")

# Configuración que me funcionó mejor después de muchas pruebas
dispositivo = "cpu"  # Uso CPU porque mi computadora no tiene GPU buena
tipo_computo = "int8"  # Más rápido en mi máquina

# Cargo el modelo (medium funciona bien para español)
modelo_whisper = whisperx.load_model("medium", dispositivo, compute_type=tipo_computo)
print("✅ Modelo cargado correctamente")

print(f"🎙️ Comenzando transcripción de: {archivo_de_audio}")
tiempo_inicio = time.time()

# Aquí hago la transcripción con diferentes niveles de parámetros
try:
    # Primero intento con parámetros avanzados
    try:
        resultado_transcripcion = modelo_whisper.transcribe(
            archivo_de_audio, 
            language="es",  # Español para el SENA
            batch_size=8,
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
            resultado_transcripcion = modelo_whisper.transcribe(archivo_de_audio, language="es", batch_size=8)
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

print("👥 Aplicando separación de hablantes...")
try:
    pipeline_diarizacion = DiarizationPipeline(use_auth_token=token_hf)
    print("🔄 Procesando diarización (esto puede tardar un poco)...")
    segmentos_hablantes = pipeline_diarizacion(archivo_de_audio)
    print("✅ Separación de hablantes completada")
except Exception as e:
    print(f"⚠️ Problemas con la diarización: {e}")
    print("🔄 Continuando sin separación de hablantes...")
    segmentos_hablantes = None

# Cargo configuración de nombres de hablantes (si existe)
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
    
    # Si tengo un nombre personalizado, lo uso
    if hablante_global in mapeo_nombres:
        return mapeo_nombres[hablante_global]
    
    # Si no, uso el formato HABLANTE X
    try:
        if '_' in hablante_global:
            numero = hablante_global.split('_')[1]
            return f"HABLANTE {numero}"
        else:
            return f"HABLANTE {hablante_global}"
    except (IndexError, ValueError):
        return f"HABLANTE {hablante_global}"

def encontrar_hablante_para_segmento(inicio_seg, fin_seg, segmentos_hablantes):
    """Encuentra qué hablante corresponde a cada segmento de audio"""
    if segmentos_hablantes is None:
        return "DESCONOCIDO"
    
    mejor_hablante = "DESCONOCIDO"
    mejor_superposicion = 0
    
    # Reviso todos los segmentos de hablantes
    for _, fila in segmentos_hablantes.iterrows():
        inicio_h = fila["start"]
        fin_h = fila["end"]
        
        # Calculo cuánto se superponen los tiempos
        inicio_overlap = max(inicio_seg, inicio_h)
        fin_overlap = min(fin_seg, fin_h)
        
        if inicio_overlap < fin_overlap:
            superposicion = fin_overlap - inicio_overlap
            duracion_segmento = fin_seg - inicio_seg
            
            # Calculo el porcentaje de superposición
            porcentaje_overlap = superposicion / duracion_segmento if duracion_segmento > 0 else 0
            
            # Si se superpone al menos 15%, lo considero válido
            if porcentaje_overlap >= 0.15 and superposicion > mejor_superposicion:
                mejor_superposicion = superposicion
                mejor_hablante = fila["speaker"]
    
    return mejor_hablante

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
    
    # Divido por intervenciones
    patron = r'(INTERVIENE HABLANTE \w+:)'
    partes = re.split(patron, texto_final)
    
    texto_formateado = ""
    
    i = 0
    while i < len(partes):
        parte = partes[i].strip()
        
        if parte.startswith('INTERVIENE HABLANTE'):
            # Esta es una etiqueta de hablante
            if i + 1 < len(partes):
                # Obtengo el texto que sigue
                texto_intervencion = partes[i + 1].strip()
                
                # Limpio el texto
                texto_intervencion = re.sub(r'\s+', ' ', texto_intervencion)
                texto_intervencion = texto_intervencion.strip()
                
                # Agrego con formato correcto
                if texto_formateado:
                    texto_formateado += "\n\n"
                
                texto_formateado += f"{parte} {texto_intervencion}"
                
                i += 2
            else:
                i += 1
        else:
            # Manejo partes sueltas o separadores
            if parte and not parte.startswith('---'):
                if texto_formateado and not parte.startswith('INTERVIENE'):
                    texto_formateado += " " + parte
            elif parte.startswith('---'):
                # Mantengo separadores de partes
                texto_formateado += f"\n\n{parte}\n\n"
            
            i += 1
    
    return texto_formateado.strip()

def procesar_segmentos_con_hablantes(resultado_alineado, segmentos_hablantes):
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
        
        # Limpio un poco el texto
        texto_segmento = re.sub(r'\s+', ' ', texto_segmento.strip())
        
        # Encuentro qué hablante corresponde a este segmento
        hablante_local = encontrar_hablante_para_segmento(tiempo_inicio, tiempo_fin, segmentos_hablantes)
        
        # Convierto a hablante global
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
    print("🔧 Suavizando cambios de hablante...")
    
    for i in range(len(segmentos_procesados)):
        seg_actual = segmentos_procesados[i]
        
        # Miro el contexto alrededor
        contexto_anterior = []
        contexto_posterior = []
        
        # Recopilo contexto de 3 segmentos hacia atrás y adelante
        for j in range(max(0, i-3), i):
            if j < len(segmentos_procesados):
                contexto_anterior.append(segmentos_procesados[j]['hablante'])
        
        for j in range(i+1, min(len(segmentos_procesados), i+4)):
            contexto_posterior.append(segmentos_procesados[j]['hablante'])
        
        # Si está rodeado por el mismo hablante, probablemente es error
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
            # Mismo hablante, agrego al grupo actual
            grupo_actual['textos'].append(seg['texto'])
            grupo_actual['cantidad_segmentos'] += 1
        else:
            # Hablante diferente, cierro grupo y creo nuevo
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
    
    # Construyo el texto final
    print(f"📝 Construyendo texto final con {len(grupos)} intervenciones...")
    
    texto_final = ""
    
    for i, grupo in enumerate(grupos):
        nombre_para_mostrar = obtener_nombre_final(grupo['hablante'])
        texto_del_grupo = " ".join(grupo['textos'])
        
        # Limpio el texto final
        texto_del_grupo = limpiar_texto_repetitivo(texto_del_grupo)
        
        # Solo agrego si tiene contenido suficiente
        if len(texto_del_grupo) > 3:
            texto_final += f"INTERVIENE {nombre_para_mostrar}: {texto_del_grupo} "
    
    # Muestro estadísticas de mi trabajo
    total_segmentos_originales = len(segmentos_procesados)
    total_grupos_procesados = len(grupos)
    
    print(f"📊 Estadísticas de mi procesamiento:")
    print(f"   - Segmentos originales: {total_segmentos_originales}")
    print(f"   - Grupos de hablantes: {total_grupos_procesados}")
    print(f"   - Caracteres en texto final: {len(texto_final)}")
    
    # Si el texto es muy corto, uso método de respaldo
    if len(texto_final) < 100:
        print("⚠️ Texto muy corto, usando método de respaldo...")
        texto_final = "INTERVIENE HABLANTE DESCONOCIDO: "
        
        for seg in segmentos:
            texto_seg = seg.get("text", "").strip()
            if texto_seg:
                texto_final += texto_seg + " "
    
    return texto_final.strip()

# Ejecuto mi algoritmo principal
print("🎯 Aplicando mi algoritmo de procesamiento...")

if segmentos_hablantes is not None:
    texto_transcrito_final = procesar_segmentos_con_hablantes(resultado_alineado, segmentos_hablantes)
else:
    # Si no tengo separación de hablantes, proceso todo como un solo hablante
    print("📝 Sin separación de hablantes, procesando como hablante único...")
    texto_transcrito_final = "INTERVIENE HABLANTE DESCONOCIDO: "
    
    segmentos = resultado_alineado["segments"] if isinstance(resultado_alineado, dict) else resultado_alineado
    
    for seg in segmentos:
        texto_seg = seg.get("text", "").strip()
        
        if texto_seg:
            texto_seg = limpiar_texto_repetitivo(texto_seg)
            if texto_seg.strip():
                texto_transcrito_final += texto_seg + " "

# Verifico la longitud antes del formateo
print(f"📏 Longitud antes del formateo: {len(texto_transcrito_final)} caracteres")

# Limpio y formato el texto final
texto_transcrito_final = limpiar_texto_repetitivo(texto_transcrito_final)
texto_transcrito_final = formatear_texto_final(texto_transcrito_final)

print(f"📏 Longitud después del formateo: {len(texto_transcrito_final)} caracteres")

# Guardo el resultado en un archivo
archivo_salida = f"{nombre_sin_extension}_transcripcion.txt"
with open(archivo_salida, "w", encoding="utf-8") as f:
    f.write(texto_transcrito_final)

tiempo_final = time.time()
print("✅ ¡Transcripción y separación de hablantes completadas!")
print(f"⏱️ Tiempo total: {round(tiempo_final - tiempo_inicio, 2)} segundos")
print(f"📄 Texto guardado en: {archivo_salida}")

# Muestro estadísticas de intervenciones
intervenciones_detectadas = [linea for linea in texto_transcrito_final.split('\n') if linea.strip().startswith('INTERVIENE')]
print(f"👥 Total de intervenciones detectadas: {len(intervenciones_detectadas)}")

# Muestro una preview del resultado
print("\n📋 Primeras líneas de mi transcripción:")
print("-" * 60)
lineas = texto_transcrito_final.split('\n')
for i, linea in enumerate(lineas[:3]):
    if linea.strip():
        print(f"{i+1}: {linea[:100]}...")

# Muestro el mapeo de hablantes que usé
print("\n🗺️ Hablantes que identifiqué en este audio:")
hablantes_usados = set()
for speaker_local, hablante_global in hablantes_globales.items():
    numero = hablante_global.split('_')[1] if '_' in hablante_global else hablante_global
    if f"HABLANTE {numero}" in texto_transcrito_final:
        nombre_final = obtener_nombre_final(hablante_global)
        print(f"   {speaker_local} → {nombre_final}")
        hablantes_usados.add(hablante_global)

if not hablantes_usados:
    print("   ℹ️ No identifiqué hablantes específicos en este audio")

print(f"\n📋 Archivos de configuración:")
print(f"   - Mapeo global: {archivo_mapeo_global}")
print(f"   - Nombres personalizados: {archivo_nombres}")
print("🔧 Para personalizar nombres: python src/python/gestionar_nombres.py")
print("\n🎉 ¡Proceso completado! Este fue mi aporte al proyecto del SENA.")