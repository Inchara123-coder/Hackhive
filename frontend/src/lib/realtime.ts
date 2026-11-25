import { io } from "socket.io-client";

export function createHelpdeskSocket(token?: string) {
  const configured =
    process.env.NEXT_PUBLIC_SOCKET_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:5000/api";
  const endpoint = new URL(configured).origin;
  return io(endpoint, {
    autoConnect: false,
    auth: token ? { token } : undefined,
    withCredentials: true,
  });
}
