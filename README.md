# Biblioteca Digital UNER — Tecnicatura Universitaria en Desarrollo Web

Archivo bibliográfico online desplegado en [bibliotecauner.netlify.app](https://bibliotecauner.netlify.app/), conectado automáticamente a [Google Drive](https://drive.google.com/drive/folders/18nwSi3XYcgd9TXWOoPEohFmeK6RledF7).

## Qué se actualizó
- **Frontend modernizado** con diseño responsivo, tema oscuro/claro, búsqueda instantánea (atajo `/`), filtros por año, cuatrimestre y materia, vista en grilla o lista, favoritos locales y modal con vista previa de PDF integrada.
- **Sin "Seguridad Informática"** ni etiquetas/filtros de **"Obligatoria" / "Optativa"**.
- **Catálogo base actualizado (`books.json`)** con los **48 PDFs** y las **14 materias** ya presentes en Google Drive.
- **Sincronización automática con Google Drive** lista para activar en 2 minutos.

## Activar sincronización automática con Google Drive (2 minutos)
No requiere tarjeta, servidor ni volver a editar la web cuando subas libros nuevos:

1. Entra a [script.google.com](https://script.google.com) con la cuenta dueña de la carpeta de Drive (`estebanchavezdev@gmail.com`) y crea un **Nuevo proyecto**.
2. Pega el contenido completo de `apps-script/Code.gs` y guarda.
3. Haz clic en **Implementar → Nueva implementación → Tipo: Aplicación web**:
   - **Ejecutar como:** Yo
   - **Quién tiene acceso:** Cualquier persona
4. Autoriza los permisos de solo lectura de Drive y copia la URL terminada en `/exec`.
5. Pega esa URL en `config.js` dentro de `APPS_SCRIPT_URL` y haz `git push`.

> **Alternativa con Netlify Function:** si prefieres usar Google Drive API v3 sin Apps Script, configura la variable de entorno `GOOGLE_DRIVE_API_KEY` en Netlify; el archivo `netlify/functions/books.js` ya está listo.

## Convención de nombres recomendada en Drive
- `Título del libro - Autor.pdf` (la web separa título y autor automáticamente).
- Puedes subir los PDFs directo en la carpeta de la materia o dentro de subcarpetas (ej. `Bibliografía/`): el sincronizador escanea recursivamente.
