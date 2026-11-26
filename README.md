# Biblioteca Digital UNER — Tecnicatura Universitaria en Desarrollo Web

Archivo bibliográfico online desplegado en [bibliotecauner.netlify.app](https://bibliotecauner.netlify.app/), conectado automáticamente a [Google Drive](https://drive.google.com/drive/folders/18nwSi3XYcgd9TXWOoPEohFmeK6RledF7).

## Características
- **Estilo código** con tipografías **Press Start 2P** (títulos) e **IBM Plex Mono** (cuerpo y controles), tema oscuro/claro, vista grilla/lista, favoritos locales y lector PDF integrado.
- **Sin "Seguridad Informática"** ni etiquetas de **"Obligatoria" / "Optativa"**.
- **Sección "Varios"** al final de la página para lecturas recomendadas fuera de la currícula.
- **Categorías temáticas automáticas (multi-etiqueta)**: cada libro recibe automáticamente 1 o más temas (ej. `Bases de Datos`, `Redes`, `Seguridad`, `Python`, `Desarrollo Web`, `Diseño y UX/UI`, etc.) combinables en el filtro. Además, si incluyes `[Tema]` en el nombre de un archivo en Drive, se agrega esa etiqueta personalizada.

## Activar sincronización automática (Google Apps Script)
1. Abre [script.google.com](https://script.google.com) → **Nuevo proyecto** y pega `apps-script/Code.gs`.
2. **Implementar → Nueva implementación → Aplicación web** (*Ejecutar como: Yo* | *Quién tiene acceso: Cualquier persona*).
3. Copia la URL terminada en `/exec`, pégala en `config.js` (`APPS_SCRIPT_URL`) y haz `git push`.
