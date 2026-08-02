import { useState, useEffect, useRef, type SubmitEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Send } from "lucide-react";
import client from "../api/client";

interface Document { id: string; filename: string; createdAt: string; }
interface Message { id: string; question: string; answer: string; }

export default function ChatApp() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [question, setQuestion] = useState("");
    const [uploading, setUploading] = useState(false);
    const [asking, setAsking] = useState(false);
    const [error, setError] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchDocuments = async () => {
        try {
            const res = await client.get("/documents");
            setDocuments(res.data.documents);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to load documents");
        }
    };

    useEffect(() => { fetchDocuments(); }, []);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const selectDocument = async (doc: Document) => {                   
        setSelectedDoc(doc);
        setError("");
        try {
            const res = await client.get(`/chat/document/${doc.id}`);
            setMessages(res.data.chats);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to load chat history");
        }
    };

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await client.post("/upload", formData);
            await fetchDocuments();
            setMessages([]);
            setSelectedDoc({ id: res.data.documentId, filename: file.name, createdAt: new Date().toISOString() });
        } catch (err: any) {
            setError(err.response?.data?.message || "Upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const handleAsk = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!question.trim() || !selectedDoc) return;
        const currentQuestion = question;
        setQuestion("");
        setAsking(true);
        setError("");
        try {
            const res = await client.post("/ask", { question: currentQuestion, documentId: selectedDoc.id });
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), question: currentQuestion, answer: res.data.answer }]);
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to get an answer");
        } finally {
            setAsking(false);
        }
    };

    return (
        <div className="flex h-screen">
            <aside className="w-72 border-r border-border bg-card flex flex-col p-4">
                <h1 className="font-display text-xl mb-6 px-1">Ask My Notes</h1>

                <Button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mb-6 gap-2">
                    <Plus size={16} />
                    {uploading ? "Uploading..." : "Add document"}
                </Button>
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />

                <div className="flex-1 overflow-y-auto space-y-1">
                    {documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground px-2">No documents yet</p>
                    ) : (
                        documents.map((doc) => (
                            <button
                                key={doc.id}
                                onClick={() => selectDocument(doc)}
                                className={`w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-md text-sm transition-colors border-l-2 ${
                                    selectedDoc?.id === doc.id
                                        ? "bg-secondary border-primary text-foreground"
                                        : "border-transparent text-muted-foreground hover:bg-secondary/50"
                                }`}
                            >
                                <FileText size={14} className="shrink-0" />
                                <span className="truncate">{doc.filename}</span>
                            </button>
                        ))
                    )}
                </div>
            </aside>

            <main className="flex-1 flex flex-col relative">
                {!selectedDoc ? (
                    <div className="flex-1 flex items-center justify-center text-center px-4">
                        <div>
                            <p className="font-display text-2xl mb-2">Nothing selected yet</p>
                            <p className="text-muted-foreground text-sm">Pick a document from the sidebar, or add a new one.</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <header className="px-6 py-4 border-b border-border font-display text-lg">
                            {selectedDoc.filename}
                        </header>

                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                            {messages.map((msg) => (
                                <div key={msg.id} className="space-y-2">
                                    <div className="ml-auto max-w-[70%] bg-secondary rounded-lg px-4 py-2.5 text-sm w-fit">
                                        {msg.question}
                                    </div>
                                    <div className="max-w-[70%] border-l-2 border-primary bg-card rounded-r-lg pl-4 pr-4 py-3 text-sm leading-relaxed">
                                        {msg.answer}
                                    </div>
                                </div>
                            ))}
                            {asking && (
                                <div className="max-w-[70%] border-l-2 border-primary/40 bg-card rounded-r-lg pl-4 pr-4 py-3 text-sm text-muted-foreground italic">
                                    Reading through the document...
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleAsk} className="p-4 border-t border-border flex gap-3">
                            <input
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Ask something about this document..."
                                disabled={asking}
                                className="flex-1 bg-secondary border border-border rounded-md px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                            />
                            <Button type="submit" disabled={asking || !question.trim()} size="icon">
                                <Send size={16} />
                            </Button>
                        </form>
                    </>
                )}
                {error && (
                    <div className="absolute bottom-24 left-6 right-6 bg-red-950/50 border border-red-800 text-red-300 text-sm px-4 py-2.5 rounded-md">
                        {error}
                    </div>
                )}
            </main>
        </div>
    );
}