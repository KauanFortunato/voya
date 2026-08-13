import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const sourcePath = process.argv[2]
const documentsPath = process.argv[3]

if (!sourcePath) {
  throw new Error('Use: npm run data:import -- /caminho/para/infos-trip.json')
}

const source = JSON.parse(await readFile(resolve(sourcePath), 'utf8'))

for (const day of source.roteiro ?? []) {
  for (const activity of day.atividades ?? []) {
    if (activity.titulo === 'Basílica de São Marcos') {
      activity.observacoes = String(activity.observacoes ?? '')
        .replace(
          'O recibo não identifica qual viajante possui o bilhete de estudante.',
          'O bilhete de estudante menor de 26 anos pertence a Kauan.',
        )
    }
  }
}

for (const document of source.documentos ?? []) {
  if (document.titulo === 'Recibo Basílica de São Marcos') {
    document.observacoes = `${String(document.observacoes ?? '').trim()} O bilhete de estudante menor de 26 anos pertence a Kauan.`
    document.classificacao_viajantes = {
      Kauan: 'estudante_menor_26',
      Kairon: 'adulto',
      Helieny: 'adulto',
      Anicio: 'adulto',
    }
  }

  if (document.titulo === 'Bilhetes Galleria Borghese') {
    document.viajantes = ['Kauan', 'Kairon']
    document.observacoes = String(document.observacoes ?? '')
      .replace('O segundo utilizador não é identificado.', 'Os bilhetes pertencem a Kauan e Kairon.')
  }
}

source.pendencias = (source.pendencias ?? []).filter(
  (pending) => !String(pending.referencia ?? '').includes('171-YE7HOST'),
)

source.contexto_viajantes = {
  ...(source.contexto_viajantes ?? {}),
  Kauan: { ...(source.contexto_viajantes?.Kauan ?? {}), estudante: true },
}

if (documentsPath) {
  const sourceDirectory = resolve(documentsPath)
  const destinationDirectory = resolve('public/trip-documents')
  const availableFiles = await readdir(sourceDirectory)
  const aliases = {
    'Informações dos voos Portugal ↔ Itália': '40-874757639-Flight-Booking-Details.pdf',
    'Informações do Airbnb de Roma': 'Roma-Airbnb-Detalhes.pdf',
    'Informações do Airbnb de Veneza': 'Veneza-Airbnb-Detalhes.pdf',
    'Bilhetes Italo atuais': 'passagens-italo.pdf',
    'Passes ACTV Venezia Daily Pass': 'Passes-Veneza.pdf',
    'Recibo Basílica de São Marcos': 'Basilica-San-Marco.pdf',
    'Bilhetes Galleria Borghese': 'Galleria-Borghese.pdf',
    'Bilhetes Coliseu, Fórum Romano e Palatino': 'COLOSSEO-FORO-ROMANO-PALATINO.pdf',
    'Bilhetes Museus Vaticanos': 'Museu-Vaticano.pdf',
    "Bilhetes Villa d'Este": 'Villa-dEste.pdf',
    'Certificado de seguro de viagem': 'Certificado de seguro_26026GCH6V.pdf',
    'Condições Gerais do seguro de viagem': 'TermsAndConditions_PT_pt.pdf',
    'Detalhes completos dos voos Booking.com': 'voos-info.pdf',
    'Detalhes Airbnb Roma': 'Roma-Airbnb-Detalhes.pdf',
    'Detalhes Airbnb Veneza': 'Veneza-Airbnb-Detalhes.pdf',
  }

  await mkdir(destinationDirectory, { recursive: true })
  for (const fileName of availableFiles) {
    await copyFile(resolve(sourceDirectory, fileName), resolve(destinationDirectory, basename(fileName)))
  }

  for (const document of source.documentos ?? []) {
    const exactName = availableFiles.includes(document.nome_arquivo) ? document.nome_arquivo : undefined
    const localName = exactName ?? aliases[document.titulo]
    if (localName && availableFiles.includes(localName)) document.arquivo_local = localName
  }
}

const destination = resolve('src/data/private-trip.json')
await writeFile(destination, `${JSON.stringify(source, null, 2)}\n`, 'utf8')
console.log(`Dados privados importados para ${destination}`)
if (documentsPath) console.log('Documentos privados copiados para public/trip-documents')
