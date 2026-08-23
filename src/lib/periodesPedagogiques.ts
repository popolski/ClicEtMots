// Périodes pédagogiques (P1-P5), bornées par les vacances scolaires
// officielles. Rentrée, Toussaint, Noël et Été sont identiques pour les
// trois zones ; seules Hiver et Printemps varient par zone - voir
// https://iniprof.fr/vacances-scolaires/periodes-pedagogiques-p1-p5
//
// Dates 2026-2027 : rentrée le 1er septembre 2026, vacances de Toussaint et
// de Noël communes aux trois zones, hiver et printemps propres à chaque
// zone. education.gouv.fr (calendrier scolaire officiel) bloque l'accès
// direct (403) : dates vérifiées via blogdumoderateur.com et
// vacances-scolaires-gouv.com. À remettre à jour chaque année sur ces mêmes
// sources (ou education.gouv.fr/calendrier-scolaire) quand une nouvelle
// rentrée approche.
export type Zone = 'A' | 'B' | 'C'

export interface Periode {
  id: 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
  label: string
  debut: string
  fin: string
}

interface AnneeScolaire {
  label: string
  parZone: Record<Zone, Periode[]>
}

const ANNEE_2026_2027: AnneeScolaire = {
  label: '2026-2027',
  parZone: {
    A: [
      { id: 'P1', label: 'Période 1 (rentrée - Toussaint)', debut: '2026-09-01', fin: '2026-10-16' },
      { id: 'P2', label: 'Période 2 (Toussaint - Noël)', debut: '2026-11-03', fin: '2026-12-18' },
      { id: 'P3', label: 'Période 3 (Noël - Hiver)', debut: '2027-01-05', fin: '2027-02-12' },
      { id: 'P4', label: 'Période 4 (Hiver - Printemps)', debut: '2027-03-02', fin: '2027-04-09' },
      { id: 'P5', label: 'Période 5 (Printemps - été)', debut: '2027-04-27', fin: '2027-07-02' },
    ],
    B: [
      { id: 'P1', label: 'Période 1 (rentrée - Toussaint)', debut: '2026-09-01', fin: '2026-10-16' },
      { id: 'P2', label: 'Période 2 (Toussaint - Noël)', debut: '2026-11-03', fin: '2026-12-18' },
      { id: 'P3', label: 'Période 3 (Noël - Hiver)', debut: '2027-01-05', fin: '2027-02-19' },
      { id: 'P4', label: 'Période 4 (Hiver - Printemps)', debut: '2027-03-09', fin: '2027-04-16' },
      { id: 'P5', label: 'Période 5 (Printemps - été)', debut: '2027-05-04', fin: '2027-07-02' },
    ],
    C: [
      { id: 'P1', label: 'Période 1 (rentrée - Toussaint)', debut: '2026-09-01', fin: '2026-10-16' },
      { id: 'P2', label: 'Période 2 (Toussaint - Noël)', debut: '2026-11-03', fin: '2026-12-18' },
      { id: 'P3', label: 'Période 3 (Noël - Hiver)', debut: '2027-01-05', fin: '2027-02-05' },
      { id: 'P4', label: 'Période 4 (Hiver - Printemps)', debut: '2027-02-23', fin: '2027-04-02' },
      { id: 'P5', label: 'Période 5 (Printemps - été)', debut: '2027-04-20', fin: '2027-07-02' },
    ],
  },
}

// Une seule année dispo pour l'instant (2026-2027) : la classe de Camille
// est en zone B, mais le sélecteur reste ouvert au cas où.
const ANNEES: AnneeScolaire[] = [ANNEE_2026_2027]

export function anneesDisponibles(): string[] {
  return ANNEES.map((a) => a.label)
}

export function periodesDe(anneeLabel: string, zone: Zone): Periode[] {
  const annee = ANNEES.find((a) => a.label === anneeLabel) ?? ANNEES[0]
  return annee.parZone[zone]
}
