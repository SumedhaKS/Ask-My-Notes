# Ask My Notes

A full-stack RAG (Retrieval-Augmented Generation) application that lets users upload documents and ask questions about them, with answers grounded strictly in the uploaded content instead of general LLM knowledge.

## How It Works

1. A user uploads a PDF, which is split into overlapping text chunks and converted into vector embeddings.
2. Embeddings are stored in a local vector database (ChromaDB), tagged with the document they belong to.
3. When a user asks a question, it's embedded the same way and compared against stored chunks to find the most relevant sections.
4. The matched chunks, along with the question, are sent to Google's Gemini API, which generates an answer grounded only in that retrieved context — and explicitly says so if the answer isn't found in the document.

## Architecture

```
Frontend (React)  →  Node Backend (Auth + Gateway)  →  AI Service (FastAPI)  →  Gemini API
                              ↓                                ↓
                         PostgreSQL                        ChromaDB
                    (users, documents, chats)          (chunks + embeddings)
```

- **Frontend** — handles document upload and the chat interface only. Never talks to the AI service directly.
- **Node Backend** — thin gateway layer. Handles JWT-based auth and forwards upload/ask requests to the AI service. Also persists document metadata and chat history to PostgreSQL.
- **AI Service** — the RAG pipeline itself: chunking, embedding, vector storage/retrieval, and prompt construction for the LLM call. Holds the only copy of the Gemini API key.
- **PostgreSQL** — stores structured data: users, uploaded document records, and Q&A history.
- **ChromaDB** — stores document content as vector embeddings, scoped per document via metadata filtering, so retrieval never crosses between different users' or documents' data.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Backend | Node.js, Express, JWT |
| AI Service | FastAPI, Python |
| Embeddings | sentence-transformers (`all-MiniLM-L6-v2`), local & free |
| Vector Store | ChromaDB (persistent, local) |
| LLM | Google Gemini API |
| Relational DB | PostgreSQL + Prisma ORM |
| Deployment | Render (backend + AI service), Vercel (frontend) |

## Project Structure

```
ask-my-notes/
├── frontend/               # React app — upload UI + chat interface
├── backend/                # Node.js/Express — auth, gateway, Postgres access
│   └── prisma/
│       └── schema.prisma
└── ai-service/              # FastAPI — RAG pipeline
    └── app/
        ├── app.py           # API routes (/upload, /ask)
        ├── ingest.py        # PDF text extraction + chunking + storage
        ├── retrieve.py      # Query embedding + similarity search
        ├── generate.py      # Prompt construction + Gemini call
        ├── embed_utils.py   # Shared embedding model (loaded once)
        └── db_utils.py      # Shared ChromaDB connection (loaded once)
```

## Setup

### Prerequisites
- Node.js
- Python 3.12+
- PostgreSQL
- A free Gemini API key from [aistudio.google.com](https://aistudio.google.com)

### AI Service
```bash
cd ai-service
uv venv && source .venv/bin/activate
uv pip install -r requirements.txt
```
Create a `.env` file:
```
GEMINI_API_KEY=your_key_here
```
Run:
```bash
uv run main.py
```
Interactive API docs available at `http://localhost:8000/docs`.

### Backend
```bash
cd backend
npm install
```
Create a `.env` file:
```
DATABASE_URL=postgresql://user:password@localhost:5432/ask_my_notes
JWT_SECRET=your_secret_here
AI_SERVICE_URL=http://localhost:8000
PORT=5000
```
Run migrations and start the server:
```bash
npx prisma migrate dev
npm run dev
```

### Frontend
```bash
cd frontend
npm install
```
Create a `.env` file:
```
VITE_API_URL=http://localhost:5000
```
Run:
```bash
npm run dev
```

## API Endpoints (AI Service)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload` | Accepts a PDF, chunks it, generates embeddings, stores in ChromaDB |
| POST | `/ask` | Accepts a question + document ID, retrieves relevant chunks, returns an LLM-generated answer |

## Key Design Decisions

- **Metadata-scoped retrieval** — each chunk is tagged with its `document_id` in ChromaDB, and retrieval queries filter on it, so answers are never generated from another document's or another user's content.
- **Singleton pattern for expensive resources** — the embedding model and the ChromaDB connection are each loaded once at import time and shared across every request, instead of being reinitialized per call.
- **Grounded generation** — the LLM prompt explicitly instructs the model to answer only from retrieved context and to say "I don't know" when the answer isn't present, reducing hallucinated answers.

## Future Improvements

- **Cursor-based pagination for chat history** — current implementation loads the full conversation for a document at once, which is fine at small scale but would need cursor-based pagination (fetch most recent N, load older messages on scroll) once conversations grow large.
- **File-hash based deduplication** — re-uploading the same document currently creates a new `Document` row and re-embeds the content into ChromaDB. Hashing the file (SHA-256) and checking against existing uploads per user avoids redundant storage and embedding cost.
(Added)
- **Stricter file-type validation** — enforced at the Multer layer (reject non-PDF uploads before they touch disk) with a matching check on the AI service side as defense-in-depth. 
(Added)

## License

MIT