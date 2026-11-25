/**
 * Alternativa opcional de sincronización vía Netlify Function + Google Drive API v3.
 * Solo requiere configurar la variable de entorno GOOGLE_DRIVE_API_KEY en Netlify.
 */
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "18nwSi3XYcgd9TXWOoPEohFmeK6RledF7";
const API_KEY = process.env.GOOGLE_DRIVE_API_KEY || "";
const EXCLUDED = ["seguridad informatica", "seguridad informática"];
const ACCENTS = [
  "#0ea5e9", "#14b8a6", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4",
  "#3b82f6", "#f43f5e", "#8b5cf6", "#22c55e", "#0284c7", "#a855f7", "#f97316"
];

async function listChildren(folderId) {
  const items = [];
  let pageToken = "";
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent("nextPageToken,files(id,name,mimeType,size,modifiedTime)");
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&pageSize=100&key=${API_KEY}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Drive API ${res.status}`);
    const data = await res.json();
    items.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return items;
}

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function parseSubject(raw) {
  const m = raw.trim().match(/^(\d{1,2})\s*[-.]\s*(.+)$/);
  return m ? { code: m[1].padStart(2, "0"), name: m[2].trim() } : { code: "", name: raw.trim() };
}

function parseFilename(filename) {
  const m = filename.trim().match(/\.([a-zA-Z0-9]{2,5})$/);
  const ext = m ? m[1].toUpperCase() : "PDF";
  const base = m ? filename.trim().slice(0, -m[0].length).trim() : filename.trim();
  const idx = base.lastIndexOf(" - ");
  if (idx > 0) {
    return { title: base.slice(0, idx).trim().replace(/_/g, " "), author: base.slice(idx + 3).trim().replace(/_/g, " "), ext };
  }
  return { title: base.replace(/_/g, " "), author: "Autor no especificado", ext };
}

async function collectFiles(folderId, meta, out) {
  const children = await listChildren(folderId);
  const subfolders = [];
  for (const item of children) {
    if (item.mimeType === "application/vnd.google-apps.folder") {
      subfolders.push(item);
    } else {
      const parsed = parseFilename(item.name);
      out.push({
        id: item.id,
        title: parsed.title,
        author: parsed.author,
        subjectCode: meta.subjectCode,
        subject: meta.subject,
        subjectName: meta.subjectName,
        year: meta.year,
        semester: meta.semester,
        format: parsed.ext,
        sizeBytes: Number(item.size || 0),
        modifiedTime: item.modifiedTime || new Date().toISOString(),
        viewUrl: `https://drive.google.com/file/d/${item.id}/view`,
        previewUrl: `https://drive.google.com/file/d/${item.id}/preview`,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${item.id}`,
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${item.id}&sz=w600`
      });
    }
  }
  await Promise.all(subfolders.map((sf) => collectFiles(sf.id, meta, out)));
}

export async function handler() {
  if (!API_KEY) {
    return {
      statusCode: 501,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "GOOGLE_DRIVE_API_KEY not configured" })
    };
  }

  try {
    const subjects = [];
    const books = [];
    const years = (await listChildren(ROOT_FOLDER_ID))
      .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
      .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));

    for (const y of years) {
      const semesters = (await listChildren(y.id))
        .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
        .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));

      for (const sem of semesters) {
        const subFolders = (await listChildren(sem.id))
          .filter((f) => f.mimeType === "application/vnd.google-apps.folder")
          .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));

        for (const sf of subFolders) {
          const norm = normalize(sf.name);
          if (EXCLUDED.some((ex) => norm.includes(normalize(ex)))) continue;

          const parsed = parseSubject(sf.name);
          const code = parsed.code || String(subjects.length + 1).padStart(2, "0");
          const fullName = `${code} - ${parsed.name}`;
          subjects.push({
            code,
            name: parsed.name,
            fullName,
            year: y.name.trim(),
            semester: sem.name.trim(),
            folderId: sf.id,
            folderUrl: `https://drive.google.com/drive/folders/${sf.id}`,
            accent: ACCENTS[subjects.length % ACCENTS.length]
          });

          await collectFiles(sf.id, {
            subjectCode: code,
            subject: fullName,
            subjectName: parsed.name,
            year: y.name.trim(),
            semester: sem.name.trim()
          }, books);
        }
      }
    }

    subjects.sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }));

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=600"
      },
      body: JSON.stringify({
        generatedAt: new Date().toISOString(),
        source: "Google Drive (Netlify Function)",
        rootFolderId: ROOT_FOLDER_ID,
        rootFolderUrl: `https://drive.google.com/drive/folders/${ROOT_FOLDER_ID}`,
        subjects,
        books
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message })
    };
  }
}
