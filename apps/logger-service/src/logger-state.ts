import WebSocket from "ws";

export const clients = new Set<WebSocket>();
export const recentLogs: string[] = [];