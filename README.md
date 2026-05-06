# Case Technique — Développeur Full Stack

## Setup

```bash
cp .env.example .env
# Éditer .env avec ta clé API

docker compose up --build
```

L'application est accessible sur [http://localhost:5173](http://localhost:5173).

---

## Ce qui a été ajouté

### Backend (`api.py`)

Endpoint SSE `/api/chat` qui streame les événements de l'agent en temps réel : `thinking`, `tool_call`, `tool_result`, `text`, `done`.

Le `ThinkingStreamParser` parse les balises `<thinking>...</thinking>` au fil des tokens sans attendre la réponse complète, et route chaque chunk vers le bon type d'événement.

### Frontend

Interface React avec affichage en temps réel du raisonnement (collapsible), des tool calls, des visualisations Plotly et des tableaux — le tout streamé token par token.

Historique des conversations en sidebar.

### Upload de CSV depuis le chat

L'endpoint `/api/upload` permet de charger un nouveau dataset directement depuis l'interface via le bouton 📎, sans rebuild ni redémarrage. L'agent intègre immédiatement le fichier et confirme le chargement dans le chat.

### Tableaux de données

L'outil `visualize` génère un fichier `.html` pour les `result_type="table"` (via `pandas.to_html`), ce qui permet de les afficher dans le même composant iframe que les figures Plotly.

---

## Tests

```bash
docker compose run --rm agent pytest tests/ -v
```

Le `ThinkingStreamParser` est testé sur 8 cas : texte sans balise, balise complète, balise répartie sur plusieurs chunks, blocs multiples, input vide, flush vide, balise non fermée, texte avant balise. Les endpoints `/api/health` et `/api/chat` sont également couverts.

---

## Note sur le thinking

Deux modes sont supportés côté backend : le thinking natif via `ThinkingPartDelta` (Claude 3.7 Sonnet avec extended thinking), et les balises `<thinking>` dans le flux texte pour les autres modèles. Avec GPT-4o, le raisonnement est internalisé par le modèle et n'apparaît pas dans le flux — c'est un comportement intrinsèque à ces modèles, indépendant de l'implémentation.
