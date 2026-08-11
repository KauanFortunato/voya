import { readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const travelers = ['kauan', 'kairon', 'helieny', 'anicio']
const manifest = [
  { file: '40-874757639-Flight-Booking-Details.pdf', title: 'Informações dos voos Portugal ↔ Itália', category: 'Voo', activities: ['2026-08-17-3', '2026-08-26-6'] },
  { file: 'voos-info.pdf', title: 'Detalhes completos dos voos Booking.com', category: 'Voo', activities: ['2026-08-17-3', '2026-08-26-6'] },
  { file: 'Roma-Airbnb-Detalhes.pdf', title: 'Detalhes Airbnb Roma', category: 'Hospedagem', activities: ['2026-08-17-4', '2026-08-26-2'] },
  { file: 'Veneza-Airbnb-Detalhes.pdf', title: 'Detalhes Airbnb Veneza', category: 'Hospedagem', activities: ['2026-08-19-6', '2026-08-21-3'] },
  { file: 'passagens-italo.pdf', title: 'Bilhetes Italo Roma ↔ Veneza', category: 'Transporte', activities: ['2026-08-19-3', '2026-08-21-6'] },
  { file: 'Passes-Veneza.pdf', title: 'Passes ACTV Venezia Daily Pass', category: 'Transporte', activities: ['2026-08-20-6'] },
  { file: 'Basilica-San-Marco.pdf', title: 'Recibo Basílica de São Marcos', category: 'Ingresso', activities: ['2026-08-20-3'] },
  { file: 'COLOSSEO-FORO-ROMANO-PALATINO.pdf', title: 'Bilhetes Coliseu, Fórum Romano e Palatino', category: 'Ingresso', activities: ['2026-08-18-4', '2026-08-18-5'] },
  { file: 'Galleria-Borghese.pdf', title: 'Bilhetes Galleria Borghese', category: 'Ingresso', activities: ['2026-08-22-3'], travelerIds: ['kauan', 'kairon'] },
  { file: 'Villa-dEste.pdf', title: "Bilhetes Villa d'Este", category: 'Ingresso', activities: ['2026-08-23-6'] },
  { file: 'Museu-Vaticano.pdf', title: 'Bilhetes Museus Vaticanos', category: 'Ingresso', activities: ['2026-08-25-5'] },
  { file: 'Certificado de seguro_26026GCH6V.pdf', title: 'Certificado de seguro de viagem', category: 'Seguro', activities: [] },
  { file: 'TermsAndConditions_PT_pt.pdf', title: 'Condições Gerais do seguro de viagem', category: 'Seguro', activities: [] },
]

const sourceDirectory = process.argv[2]
const replaceExisting = process.argv.includes('--replace')
const baseUrl = process.env.VOYA_APP_URL?.replace(/\/$/, '')
const password = process.env.VOYA_BOOTSTRAP_PASSWORD

if (!sourceDirectory || !baseUrl || !password) {
  throw new Error('Use VOYA_APP_URL e VOYA_BOOTSTRAP_PASSWORD com: node scripts/sync-trip-documents.mjs /pasta [--replace]')
}

for (const item of manifest) await stat(resolve(sourceDirectory, item.file))

const login = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Kauan', password }),
})
if (!login.ok) throw new Error(`Login recusado pelo Voya (${login.status})`)
const cookie = login.headers.get('set-cookie')?.split(';')[0]
if (!cookie) throw new Error('O Voya não devolveu a sessão de importação')

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { cookie, ...options.headers },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error ?? `Falha em ${path} (${response.status})`)
  }
  return response
}

try {
  const initial = await api('/api/documents').then((response) => response.json())
  if (!Array.isArray(initial.activities)) {
    throw new Error('Atualize o container do Voya antes de sincronizar os documentos')
  }
  const activityIds = new Map(initial.activities.map((activity) => [activity.sourceKey, activity.id]))
  for (const item of manifest) {
    for (const sourceKey of item.activities) {
      if (!activityIds.has(sourceKey)) throw new Error(`Atividade não encontrada: ${sourceKey}`)
    }
  }

  const currentByFilename = new Map(initial.documents.map((document) => [document.originalFilename, document]))
  for (const item of manifest) {
    const linkedIds = item.activities.map((sourceKey) => activityIds.get(sourceKey))
    const current = currentByFilename.get(item.file)
    if (current) {
      await api(`/api/documents/${current.id}/activities`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: linkedIds }),
      })
      console.info(`Atualizado: ${item.title}`)
      continue
    }

    const body = new FormData()
    body.append('title', item.title)
    body.append('category', item.category)
    body.append('travelerIds', JSON.stringify(item.travelerIds ?? travelers))
    body.append('activityIds', JSON.stringify(linkedIds))
    body.append('file', new Blob([await readFile(resolve(sourceDirectory, item.file))], { type: 'application/pdf' }), item.file)
    const uploaded = await api('/api/documents', { method: 'POST', body }).then((response) => response.json())
    currentByFilename.set(item.file, uploaded.document)
    console.info(`Importado: ${item.title}`)
  }

  if (replaceExisting) {
    const desiredFilenames = new Set(manifest.map((item) => item.file))
    for (const document of initial.documents) {
      if (desiredFilenames.has(document.originalFilename)) continue
      await api(`/api/documents/${document.id}`, { method: 'DELETE' })
      console.info(`Removido: ${document.title}`)
    }
  }
} finally {
  await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST', headers: { cookie } }).catch(() => undefined)
}
