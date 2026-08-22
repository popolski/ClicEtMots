// Le site est déployé dans un sous-dossier (/clicetmots/ sur OVH), pas à la
// racine du domaine — contrairement à Vercel qui servait tout depuis "/".
// Vite préfixe automatiquement les assets qu'il connaît (imports JS, liens
// dans index.html), mais pas les chemins bruts venus des données (JSON des
// phonèmes, mascottes) : ceux-ci doivent passer par cette fonction pour
// rester valides une fois servis depuis /clicetmots/ plutôt que /.
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return base + path
}
