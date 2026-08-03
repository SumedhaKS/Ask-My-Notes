import { useState, type SubmitEvent, type ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import client from "../api/client";

interface SignupForm { name: string; email: string; password: string; }

export default function Signup() {
    const [form, setForm] = useState<SignupForm>({ name: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e: ChangeEvent<HTMLInputElement>) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await client.post("/signup", form);
            navigate("/signin");
        } catch (err: any) {
            setError(err.response?.data?.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 text-center">
                    <h1 className="font-display text-3xl mb-2">Ask My Notes</h1>
                    <p className="text-muted-foreground text-sm">Upload a document. Ask it anything.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-lg p-6">
                    <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">Name</label>
                        <Input name="name" value={form.name} onChange={handleChange} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">Email</label>
                        <Input name="email" type="email" value={form.email} onChange={handleChange} required />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm text-muted-foreground">Password</label>
                        <Input name="password" type="password" value={form.password} onChange={handleChange} required />
                    </div>

                    {error && <p className="text-sm text-red-400 border-l-2 border-red-400 pl-3">{error}</p>}

                    <Button type="submit" disabled={loading} className="w-full">
                        {loading ? "Creating account..." : "Create account"}
                    </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    Already have an account? <Link to="/signin" className="text-primary hover:underline">Sign in</Link>
                </p>
            </div>
        </div>
    );
}
// works