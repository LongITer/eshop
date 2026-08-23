import { kafka } from "@packages/utils/kafka";
import { NextRequest, NextResponse } from "next/server";

const producer = kafka.producer();
let isConnected = false;

const connectProducer = async () => {
  if (!isConnected) {
    await producer.connect();
    isConnected = true;
  }
};

export async function POST(req: NextRequest) {
  try {
    const eventData = await req.json();

    await connectProducer();

    await producer.send({
      topic: "users-events",
      messages: [
        {
          key: eventData.userId,
          value: JSON.stringify({
            ...eventData,
            timestamp: Date.now(),
          }),
        },
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to produce Kafka event:", error);
    return NextResponse.json(
      { error: "Failed to send event" },
      { status: 500 },
    );
  }
}
