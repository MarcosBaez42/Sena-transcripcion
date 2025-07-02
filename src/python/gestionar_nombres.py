#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para gestionar nombres de hablantes de forma interactiva
"""

import json
import os
import sys

def cargar_mapeo_global():
    """Carga el mapeo global de hablantes"""
    try:
        with open("mapeo_hablantes_global.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print("No se encontró mapeo_hablantes_global.json")
        return {}

def cargar_nombres():
    """Carga los nombres personalizados"""
    try:
        with open("hablantes.json", "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def guardar_nombres(nombres):
    """Guarda los nombres personalizados"""
    try:
        with open("hablantes.json", "w", encoding="utf-8") as f:
            json.dump(nombres, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error al guardar: {e}")
        return False

def mostrar_hablantes_detectados():
    """Muestra todos los hablantes que han sido detectados"""
    mapeo_global = cargar_mapeo_global()
    nombres = cargar_nombres()
    
    if not mapeo_global:
        print("No hay hablantes detectados aún. Ejecuta primero una transcripción.")
        return
    
    print("\nHABLANTES DETECTADOS:")
    print("=" * 50)
    
    # Obtener todos los hablantes globales únicos
    hablantes_globales = sorted(set(mapeo_global.values()), key=lambda x: int(x.split('_')[1]))
    
    for hablante_global in hablantes_globales:
        numero = hablante_global.split('_')[1]
        nombre_actual = nombres.get(hablante_global, f"HABLANTE {numero}")
        
        # Mostrar qué speakers locales mapean a este global
        speakers_locales = [k for k, v in mapeo_global.items() if v == hablante_global]
        
        print(f"\n{hablante_global} -> {nombre_actual}")
        print(f"   Detectado como: {', '.join(speakers_locales)}")

def asignar_nombres_interactivo():
    """Permite asignar nombres de forma interactiva"""
    mapeo_global = cargar_mapeo_global()
    nombres = cargar_nombres()
    
    if not mapeo_global:
        print("No hay hablantes detectados aún. Ejecuta primero una transcripción.")
        return
    
    print("\nASIGNAR NOMBRES A HABLANTES")
    print("=" * 50)
    print("Presiona Enter para mantener el nombre actual")
    print("Escribe 'salir' para terminar")
    
    # Obtener todos los hablantes globales únicos
    hablantes_globales = sorted(set(mapeo_global.values()), key=lambda x: int(x.split('_')[1]))
    
    cambios_realizados = False
    
    for hablante_global in hablantes_globales:
        numero = hablante_global.split('_')[1]
        nombre_actual = nombres.get(hablante_global, f"HABLANTE {numero}")
        
        # Mostrar contexto
        speakers_locales = [k for k, v in mapeo_global.items() if v == hablante_global]
        print(f"\n{hablante_global}")
        print(f"Detectado como: {', '.join(speakers_locales)}")
        print(f"Nombre actual: {nombre_actual}")
        
        nuevo_nombre = input(f"Nuevo nombre (Enter para mantener): ").strip()
        
        if nuevo_nombre.lower() == "salir":
            break
        elif nuevo_nombre:
            nombres[hablante_global] = nuevo_nombre
            cambios_realizados = True
            print(f"✓ {hablante_global} -> {nuevo_nombre}")
    
    if cambios_realizados:
        if guardar_nombres(nombres):
            print("\n✓ Nombres guardados correctamente")
        else:
            print("\n✗ Error al guardar nombres")
    else:
        print("\nNo se realizaron cambios")

def mostrar_estadisticas():
    """Muestra estadísticas de los hablantes"""
    mapeo_global = cargar_mapeo_global()
    nombres = cargar_nombres()
    
    if not mapeo_global:
        print("No hay datos de hablantes disponibles")
        return
    
    print("\nESTADÍSTICAS DE HABLANTES")
    print("=" * 50)
    
    # Contar hablantes únicos
    hablantes_globales = set(mapeo_global.values())
    speakers_locales = set(mapeo_global.keys())
    
    print(f"Hablantes únicos detectados: {len(hablantes_globales)}")
    print(f"Total de detecciones locales: {len(speakers_locales)}")
    print(f"Hablantes con nombres personalizados: {len(nombres)}")
    
    # Mostrar distribución
    print("\nDistribución por hablante:")
    for hablante_global in sorted(hablantes_globales, key=lambda x: int(x.split('_')[1])):
        count = sum(1 for v in mapeo_global.values() if v == hablante_global)
        numero = hablante_global.split('_')[1]
        nombre = nombres.get(hablante_global, f"HABLANTE {numero}")
        print(f"  {nombre}: {count} detecciones")

def limpiar_mapeo():
    """Permite limpiar el mapeo global (CUIDADO)"""
    print("\n¡ADVERTENCIA!")
    print("Esto eliminará todo el mapeo de hablantes y empezará desde cero.")
    print("Solo hazlo si quieres resetear completamente el sistema.")
    
    confirmacion = input("\n¿Estás seguro? Escribe 'CONFIRMAR' para continuar: ")
    
    if confirmacion == "CONFIRMAR":
        try:
            if os.path.exists("mapeo_hablantes_global.json"):
                os.remove("mapeo_hablantes_global.json")
            if os.path.exists("hablantes.json"):
                os.remove("hablantes.json")
            print("✓ Mapeo eliminado. El próximo audio empezará con HABLANTE 1")
        except Exception as e:
            print(f"Error al eliminar archivos: {e}")
    else:
        print("Operación cancelada")

def main():
    print("🎭 GESTOR DE NOMBRES DE HABLANTES")
    print("=" * 50)
    
    while True:
        print("\nOpciones disponibles:")
        print("1. Ver hablantes detectados")
        print("2. Asignar nombres a hablantes")
        print("3. Ver estadísticas")
        print("4. Limpiar mapeo (CUIDADO)")
        print("5. Salir")
        
        opcion = input("\nElige una opción (1-5): ").strip()
        
        if opcion == "1":
            mostrar_hablantes_detectados()
        elif opcion == "2":
            asignar_nombres_interactivo()
        elif opcion == "3":
            mostrar_estadisticas()
        elif opcion == "4":
            limpiar_mapeo()
        elif opcion == "5":
            print("¡Hasta luego!")
            break
        else:
            print("Opción no válida")

if __name__ == "__main__":
    main()