import { ValidationError } from "@packages/error-handler";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import {
  clearUnseenCount,
  getUnseenCount,
} from "@packages/libs/redis/message.redis";
import { NextFunction, Request, Response } from "express";

// Create a new conversation
export const newConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { sellerId } = req.body;
    const userId = req.user.id;

    if (!sellerId) {
      return next(new ValidationError("Seller Id is required!"));
    }

    const existingGroup = await prisma.conversationGroup.findFirst({
      where: {
        isGroup: false,
        participantIds: {
          hasEvery: [sellerId, userId],
        },
      },
    });

    if (existingGroup) {
      return res.status(200).json({
        conversationId: existingGroup.id,
        isNew: false,
      });
    }

    // Create a new group
    const newGroup = await prisma.conversationGroup.create({
      data: {
        isGroup: false,
        creatorId: userId,
        participantIds: [userId, sellerId],
      },
    });

    await prisma.participant.createMany({
      data: [
        {
          userId: userId,
          conversationId: newGroup.id,
        },
        {
          userId: sellerId,
          conversationId: newGroup.id,
        },
      ],
    });

    return res.status(200).json({
      conversationId: newGroup.id,
      isNew: true,
    });
  } catch (error) {
    next(error);
  }
};

// Get user conversations
export const getUserConversations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user.id;

    // Find all consersationGroups where the user is a participant
    const conversations = await prisma.conversationGroup.findMany({
      where: {
        participantIds: {
          has: userId,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const responseData = await Promise.all(
      conversations.map(async (group) => {
        // Get the sellerParticipant inside this conversation
        const sellerParticipant = await prisma.participant.findFirst({
          where: {
            conversationId: group.id,
            sellerId: { not: null },
          },
        });

        let seller = null;
        if (sellerParticipant?.sellerId) {
          seller = await prisma.sellers.findUnique({
            where: {
              id: sellerParticipant.sellerId,
            },
            include: {
              shop: {
                include: {
                  avatar: true,
                },
              },
            },
          });
        }

        // Get last message in the conversation
        const lastMessage = await prisma.message.findFirst({
          where: {
            conversationId: group.id,
          },
          orderBy: { createdAt: "desc" },
        });

        // Check online status from Redis
        let isOnline = false;
        if (sellerParticipant?.sellerId) {
          const redisKey = `online:seller:${sellerParticipant.sellerId}`;
          const redisResult = await redis.get(redisKey);
          isOnline = !!redisResult;
        }

        const unreadCount = await getUnseenCount("user", group.id);

        return {
          conversationId: group.id,
          seller: {
            id: seller?.id || null,
            name: seller?.shop?.name || "Unknown",
            isOnline,
            avatar: seller?.shop?.avatar?.[0]?.url || null,
          },
          lastMessage:
            lastMessage?.content || "Say something to start a conversation",
          lastMessageAt: lastMessage?.createdAt || group.updatedAt,
          unreadCount,
        };
      }),
    );

    return res.status(200).json({ conversations: responseData });
  } catch (error) {
    next(error);
  }
};

// Get seller conversations
export const getSellerConversations = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sellerId = (req as any).seller?.id;

    // Find all conversationGroups where the seller is a participant
    const conversations = await prisma.conversationGroup.findMany({
      where: {
        participantIds: {
          has: sellerId,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const responseData = await Promise.all(
      conversations.map(async (group) => {
        // Get the userParticipant inside this conversation
        const userParticipant = await prisma.participant.findFirst({
          where: {
            conversationId: group.id,
            userId: { not: null },
          },
        });

        let buyer = null;
        if (userParticipant?.userId) {
          buyer = await prisma.users.findUnique({
            where: {
              id: userParticipant.userId,
            },
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          });
        }

        // Get last message in the conversation
        const lastMessage = await prisma.message.findFirst({
          where: {
            conversationId: group.id,
          },
          orderBy: { createdAt: "desc" },
        });

        // Check online status from Redis
        let isOnline = false;
        if (userParticipant?.userId) {
          const redisKey = `online:user:${userParticipant.userId}`;
          const redisResult = await redis.get(redisKey);
          isOnline = !!redisResult;
        }

        const unreadCount = await getUnseenCount("seller", group.id);

        return {
          conversationId: group.id,
          user: {
            id: buyer?.id || null,
            name: buyer?.name || "Unknown",
            email: buyer?.email || null,
            avatar: buyer?.avatar || null,
            isOnline,
          },
          lastMessage:
            lastMessage?.content || "Say something to start a conversation",
          lastMessageAt: lastMessage?.createdAt || group.updatedAt,
          unreadCount,
        };
      }),
    );

    return res.status(200).json({ conversations: responseData });
  } catch (error) {
    next(error);
  }
};

export const fetchMessages = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = 10;

    if (!conversationId) {
      return next(new ValidationError("Conversation Id is required!"));
    }

    const conversation = await prisma.conversationGroup.findUnique({
      where: {
        id: conversationId,
        participantIds: {
          has: userId,
        },
      },
    });

    if (!conversation) {
      return next(new ValidationError("Conversation not found!"));
    }

    // Check if user has access to this conversation
    const userConversation = await prisma.conversationGroup.findUnique({
      where: { id: conversationId },
    });

    if (!userConversation) {
      return next(new ValidationError("Conversation not found!"));
    }

    const hasAccess = conversation.participantIds.includes(userId);

    if (!hasAccess) {
      return next(
        new ValidationError("You don't have access to this conversation!"),
      );
    }

    await clearUnseenCount("user", conversationId);

    const sellerParticipant = await prisma.participant.findFirst({
      where: {
        conversationId,
        sellerId: { not: null },
      },
    });

    // Fetch seller info
    let seller = null;
    let isOnline = false;

    if (sellerParticipant?.sellerId) {
      seller = await prisma.sellers.findUnique({
        where: { id: sellerParticipant.sellerId },
        include: {
          shop: {
            include: {
              avatar: true,
            },
          },
        },
      });

      const redisKey = `online:seller:${sellerParticipant.sellerId}`;
      const redisResult = await redis.get(redisKey);
      isOnline = !!redisResult;
    }

    // Fetch paginated messages(latest first)
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return res.status(200).json({
      messages,
      seller: {
        id: seller?.id || null,
        name: seller?.shop?.name || "Unknown",
        avatar: seller?.shop?.avatar?.[0]?.url || null,
        isOnline,
      },
      currentPage: page,
      hasMore: messages.length === pageSize,
    });
  } catch (error) {
    return next(error);
  }
};

export const fetchSellerMessages = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sellerId = (req as any).seller?.id;
    const { conversationId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = 10;

    if (!conversationId) {
      return next(new ValidationError("Conversation Id is required!"));
    }

    // Verify the conversation exists and the seller is a participant
    const conversation = await prisma.conversationGroup.findUnique({
      where: {
        id: conversationId,
        participantIds: {
          has: sellerId,
        },
      },
    });

    if (!conversation) {
      return next(new ValidationError("Conversation not found!"));
    }

    const hasAccess = conversation.participantIds.includes(sellerId);

    if (!hasAccess) {
      return next(
        new ValidationError("You don't have access to this conversation!"),
      );
    }

    // Clear unread count for seller
    await clearUnseenCount("seller", conversationId);

    // Find the buyer participant in this conversation
    const userParticipant = await prisma.participant.findFirst({
      where: {
        conversationId,
        userId: { not: null },
      },
    });

    // Fetch buyer info
    let buyer = null;
    let isOnline = false;

    if (userParticipant?.userId) {
      buyer = await prisma.users.findUnique({
        where: { id: userParticipant.userId },
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      });

      const redisKey = `online:user:${userParticipant.userId}`;
      const redisResult = await redis.get(redisKey);
      isOnline = !!redisResult;
    }

    // Fetch paginated messages (latest first)
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return res.status(200).json({
      messages,
      user: {
        id: buyer?.id || null,
        name: buyer?.name || "Unknown",
        avatar: buyer?.avatar?.[0]?.url || null,
        isOnline,
      },
      currentPage: page,
      hasMore: messages.length === pageSize,
    });
  } catch (error) {
    return next(error);
  }
};
