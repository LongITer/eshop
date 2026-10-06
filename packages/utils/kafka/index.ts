import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "kafka-service",
  brokers: (process.env.KAFKA_BROKERS || "pkc-ldvr1.asia-southeast1.gcp.confluent.cloud:9092").split(','),
  ssl: process.env.KAFKA_SSL !== 'false',
  sasl: process.env.KAFKA_API_KEY ? {
    mechanism: "plain",
    username: process.env.KAFKA_API_KEY!,
    password: process.env.KAFKA_API_SECRET!,
  } : undefined,
});
