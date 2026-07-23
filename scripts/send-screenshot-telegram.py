import os
import sys
import requests
import subprocess
import tempfile
from pathlib import Path

# Configuración de Telegram
BOT_TOKEN = "8798093524:AAGon-9SrOKqLefgncEfjL5f1K8H3ZGYmIU"
CHAT_ID = "6954214949"

def send_photo(image_path, caption=""):
    """Enviar foto por Telegram"""
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto"
    with open(image_path, "rb") as photo:
        files = {"photo": photo}
        data = {"chat_id": CHAT_ID, "caption": caption}
        response = requests.post(url, files=files, data=data)
    return response.json()

def take_screenshot(window_title=None, active_window=False, output_path=None):
    """Tomar captura de pantalla usando el script de PowerShell"""
    
    # Ruta al script de screenshot
    skill_path = Path.home() / ".agents" / "skills" / "screenshot" / "scripts" / "take_screenshot.ps1"
    
    if not skill_path.exists():
        print(f"Error: No se encontró el script en {skill_path}")
        return None
    
    # Preparar argumentos
    args = ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(skill_path)]
    
    if output_path:
        args.extend(["-Path", output_path])
    else:
        args.extend(["-Mode", "temp"])
    
    if active_window:
        args.append("-ActiveWindow")
    
    # Ejecutar script
    try:
        result = subprocess.run(args, capture_output=True, text=True, check=True)
        output = result.stdout.strip()
        
        # El script devuelve la ruta del archivo
        if output and os.path.exists(output):
            return output
        
        print(f"Error: No se pudo obtener ruta de captura")
        print(f"Salida: {output}")
        print(f"Error: {result.stderr}")
        return None
        
    except subprocess.CalledProcessError as e:
        print(f"Error ejecutando script: {e}")
        print(f"Salida: {e.stdout}")
        print(f"Error: {e.stderr}")
        return None

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Tomar captura y enviar por Telegram")
    parser.add_argument("--title", "-t", help="Título de la ventana a capturar")
    parser.add_argument("--active", "-a", action="store_true", help="Capturar ventana activa")
    parser.add_argument("--caption", "-c", default="📸 Captura de pantalla", help="Caption para Telegram")
    parser.add_argument("--output", "-o", help="Ruta de salida (opcional)")
    
    args = parser.parse_args()
    
    # Tomar captura
    print("Tomando captura de pantalla...")
    screenshot_path = take_screenshot(
        window_title=args.title,
        active_window=args.active,
        output_path=args.output
    )
    
    if not screenshot_path:
        print("Error al tomar captura")
        sys.exit(1)
    
    print(f"Captura guardada: {screenshot_path}")
    
    # Enviar por Telegram
    caption = args.caption
    if args.title:
        caption = f"{caption} - {args.title}"
    
    print("Enviando por Telegram...")
    result = send_photo(screenshot_path, caption)
    
    if result.get("ok"):
        print("OK: Captura enviada")
    else:
        print(f"Error: {result.get('description', 'Error desconocido')}")
        sys.exit(1)
    
    # Eliminar archivo temporal si no se especificó salida
    if not args.output:
        try:
            os.remove(screenshot_path)
        except:
            pass

if __name__ == "__main__":
    main()
