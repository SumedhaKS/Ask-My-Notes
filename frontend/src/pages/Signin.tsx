import { useState, type SubmitEvent, type ChangeEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import client from "../api/client";

interface SigninForm { email: string; password: string; }

export default function Signin() {
    const [form, setForm] = useState<SigninForm>({ email: "", password: "" });
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
            const res = await client.post("/signin", form);
            localStorage.setItem("token", res.data.token);
            navigate("/chat");
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
                    <p className="text-muted-foreground text-sm">Pick up where you left off with your documents.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-lg p-6">
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
                        {loading ? "Signing in..." : "Sign in"}
                    </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                    New here? <Link to="/signup" className="text-primary hover:underline">Create an account</Link>
                </p>
            </div>
        </div>
    );
}