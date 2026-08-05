import client from "@/api/client";

export async function healthChecker() {
    await client.get('/health-check');
}

