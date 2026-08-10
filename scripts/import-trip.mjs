import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const sourcePath = process.argv[2]

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
}

source.pendencias = (source.pendencias ?? []).filter(
  (pending) => !String(pending.referencia ?? '').includes('171-YE7HOST'),
)

source.contexto_viajantes = {
  ...(source.contexto_viajantes ?? {}),
  Kauan: { ...(source.contexto_viajantes?.Kauan ?? {}), estudante: true },
}

const destination = resolve('src/data/private-trip.json')
await writeFile(destination, `${JSON.stringify(source, null, 2)}\n`, 'utf8')
console.log(`Dados privados importados para ${destination}`)
