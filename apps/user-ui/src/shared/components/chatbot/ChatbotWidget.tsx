'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ShoppingCart } from 'lucide-react';
import { useStore } from '../../../store';
import useUser from '../../../hooks/useUser';
import useLocationTracking from '../../../hooks/useLocationTracking';
import useDeviceTracking from '../../../hooks/useDeviceTracking';

const CONVERSATION_STORAGE_KEY = 'chatbot_conversation_id';

// ─── Types ──────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  messageType: 'text' | 'quick_reply' | 'config_suggestion' | 'product_card';
  metadata?: any;
  createdAt: string;
}

interface QuickReplyOption {
  key: string;
  label: string;
  description?: string;
}

interface MatchedProduct {
  id: string;
  title: string;
  slug: string;
  sale_price: number;
  regular_price: number;
  image: string | null;
  shopName: string;
  rating: number;
  stock: number;
  shopId: string;
}

// ─── Main Widget Component ──────────────────────────────────────────

const ChatbotWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sessionId] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('chatbot_session_id');
      if (stored) return stored;
      const newId = crypto.randomUUID();
      sessionStorage.setItem('chatbot_session_id', newId);
      return newId;
    }
    return '';
  });
  const { user } = useUser();
  const location = useLocationTracking();
  const deviceInfo = useDeviceTracking();
  const addToCart = useStore((state) => state.addToCart);
  const cart = useStore((state) => state.cart);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const API_BASE = '/chatbot/api';

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // ─── API Functions ──────────────────────────────────────────────

  const startConversation = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedConversationId = sessionStorage.getItem(
        CONVERSATION_STORAGE_KEY
      );

      if (savedConversationId) {
        try {
          const existing = await axios.get(
            `${API_BASE}/conversations/${savedConversationId}`,
            {
              params: { sessionId },
              withCredentials: true,
            }
          );
          const conversation = existing.data.conversation;
          setConversationId(conversation.id);
          setMessages(conversation.messages
            .filter((message: ChatMessage) => message.role === 'user' || message.role === 'bot')
            .map((message: ChatMessage) => ({ ...message })));
          return;
        } catch {
          sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
        }
      }

      const res = await axios.post(
        `${API_BASE}/conversations`,
        { sessionId },
        { withCredentials: true }
      );

      setConversationId(res.data.conversationId);
      sessionStorage.setItem(
        CONVERSATION_STORAGE_KEY,
        res.data.conversationId
      );
      setMessages([
        {
          id: res.data.message.id,
          role: 'bot',
          content: res.data.message.content,
          messageType: res.data.message.messageType,
          metadata: res.data.message.metadata,
          createdAt: res.data.message.createdAt,
        },
      ]);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      // Fallback greeting
      setMessages([
        {
          id: 'fallback-greeting',
          role: 'bot',
          content:
            'Xin chào! 👋 Tôi là trợ lý tư vấn build PC của Eshop.\n\nHiện tại đang có lỗi kết nối. Vui lòng thử lại sau.',
          messageType: 'text',
          metadata: null,
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      messageType: 'text',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await axios.post(
        `${API_BASE}/chat`,
        {
          conversationId,
          sessionId,
          message: text.trim(),
        },
        { withCredentials: true }
      );

      if (res.data.conversationId && !conversationId) {
        setConversationId(res.data.conversationId);
      }

      const botMsg: ChatMessage = {
        id: res.data.message.id,
        role: 'bot',
        content: res.data.message.content,
        messageType: res.data.message.messageType,
        metadata: res.data.message.metadata,
        createdAt: res.data.message.createdAt,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'bot',
          content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại! 🙏',
          messageType: 'text',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickReply = (option: QuickReplyOption) => {
    sendMessage(option.key);
  };

  const handleToggle = () => {
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening && messages.length === 0) {
      startConversation();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleRestart = () => {
    sessionStorage.removeItem(CONVERSATION_STORAGE_KEY);
    setConversationId(null);
    setMessages([]);
    startConversation();
  };

  // ─── Render Helpers ─────────────────────────────────────────────

  const renderMarkdown = (text: string) => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    return text
      .split('\n')
      .map((line) => {
        let processed = escapeHtml(line)
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');

        if (line.startsWith('• ') || line.startsWith('- ')) {
          processed = `<span class="chatbot-list-item">${processed}</span>`;
        }
        if (line.startsWith('---')) {
          return '<hr class="chatbot-hr" />';
        }

        return processed;
      })
      .join('<br />');
  };

  const renderMessage = (msg: ChatMessage) => {
    const isBot = msg.role === 'bot';
    return (
      <div
        key={msg.id}
        className={`chatbot-message ${isBot ? 'chatbot-message-bot' : 'chatbot-message-user'}`}
      >
        {isBot && (
          <div className="chatbot-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="8.5" cy="15.5" r="1.5" />
              <circle cx="15.5" cy="15.5" r="1.5" />
              <path d="M12 3v4" />
              <path d="M8 7h8" />
              <path d="M12 7v4" />
            </svg>
          </div>
        )}
        <div className={`chatbot-bubble ${isBot ? 'chatbot-bubble-bot' : 'chatbot-bubble-user'}`}>
          <div
            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
          />

          {/* Quick Reply Buttons */}
          {isBot &&
            msg.messageType === 'quick_reply' &&
            msg.metadata?.options && (
              <div className="chatbot-quick-replies">
                {(msg.metadata.options as QuickReplyOption[]).map((opt) => (
                  <button
                    key={opt.key}
                    className="chatbot-quick-reply-btn"
                    onClick={() => handleQuickReply(opt)}
                    disabled={isLoading}
                    title={opt.description || opt.label}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

          {/* Product Cards */}
          {isBot &&
            (msg.messageType === 'product_card' ||
              msg.messageType === 'config_suggestion') &&
            msg.metadata?.products && (
              <div className="chatbot-products-grid">
                {(msg.metadata.products as MatchedProduct[]).map((product) => (
                  <div
                    key={product.id}
                    className="chatbot-product-card"
                  >
                    <a
                      href={`/product/${product.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="chatbot-product-link"
                    >
                      {product.image && (
                        <img
                          src={product.image}
                          alt={product.title}
                          className="chatbot-product-img"
                        />
                      )}
                      <div className="chatbot-product-info">
                        <p className="chatbot-product-title">{product.title}</p>
                        <p className="chatbot-product-price">
                          {product.sale_price.toLocaleString('vi-VN')}đ
                        </p>
                        {product.regular_price > product.sale_price && (
                          <p className="chatbot-product-old-price">
                            {product.regular_price.toLocaleString('vi-VN')}đ
                          </p>
                        )}
                        <div className="chatbot-product-meta">
                          <span>⭐ {product.rating}</span>
                          <span>{product.shopName}</span>
                        </div>
                      </div>
                    </a>
                    <button
                      type="button"
                      className="chatbot-product-add-btn"
                      title={cart.some((item) => item.id === product.id) ? 'Đã có trong giỏ' : 'Thêm vào giỏ'}
                      aria-label={`Thêm ${product.title} vào giỏ hàng`}
                      disabled={cart.some((item) => item.id === product.id)}
                      onClick={() => addToCart(
                        {
                          id: product.id,
                          title: product.title,
                          price: product.sale_price,
                          sale_price: product.sale_price,
                          regular_price: product.regular_price,
                          images: product.image ? [product.image] : [],
                          slug: product.slug,
                          shopId: product.shopId,
                          quantity: 1,
                        },
                        user,
                        location,
                        deviceInfo
                      )}
                    >
                      <ShoppingCart size={14} aria-hidden="true" />
                      <span>{cart.some((item) => item.id === product.id) ? 'Trong giỏ' : 'Thêm giỏ'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    );
  };

  // ─── Main Render ────────────────────────────────────────────────

  return (
    <>
      {/* Chat Window */}
      <div className={`chatbot-window ${isOpen ? 'chatbot-window-open' : ''}`}>
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-info">
            <div className="chatbot-header-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="8.5" cy="15.5" r="1.5" />
                <circle cx="15.5" cy="15.5" r="1.5" />
                <path d="M12 3v4" />
                <path d="M8 7h8" />
                <path d="M12 7v4" />
              </svg>
            </div>
            <div>
              <h3 className="chatbot-header-title">PC Builder Assistant</h3>
              <p className="chatbot-header-subtitle">Tư vấn build cấu hình PC</p>
            </div>
          </div>
          <div className="chatbot-header-actions">
            <button
              className="chatbot-header-btn"
              onClick={handleRestart}
              title="Bắt đầu lại"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              className="chatbot-header-btn"
              onClick={() => setIsOpen(false)}
              title="Đóng"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chatbot-messages">
          {messages.map(renderMessage)}

          {isLoading && (
            <div className="chatbot-message chatbot-message-bot">
              <div className="chatbot-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="8.5" cy="15.5" r="1.5" />
                  <circle cx="15.5" cy="15.5" r="1.5" />
                  <path d="M12 3v4" />
                  <path d="M8 7h8" />
                  <path d="M12 7v4" />
                </svg>
              </div>
              <div className="chatbot-bubble chatbot-bubble-bot">
                <div className="chatbot-typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chatbot-input-area">
          <input
            ref={inputRef}
            type="text"
            className="chatbot-input"
            placeholder="Nhập tin nhắn..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />
          <button
            className="chatbot-send-btn"
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading || !inputValue.trim()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating Bubble */}
      <button
        className={`chatbot-bubble-btn ${isOpen ? 'chatbot-bubble-btn-hidden' : ''}`}
        onClick={handleToggle}
        aria-label="Mở chatbot tư vấn PC"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <circle cx="8.5" cy="15.5" r="1.5" />
          <circle cx="15.5" cy="15.5" r="1.5" />
          <path d="M12 3v4" />
          <path d="M8 7h8" />
          <path d="M12 7v4" />
        </svg>
        <span className="chatbot-bubble-badge">PC</span>
      </button>
    </>
  );
};

export default ChatbotWidget;
