import { useState, useEffect, useRef, useCallback } from "react";
import { api, API, useAuth } from "../App";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  MessageSquare, Send, Plus, Users, User, Hash, Search, X, 
  Image as ImageIcon, Smile, Upload, Loader2, Trash2, Settings, Volume2, VolumeX
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

// Emojis for picker and reactions
const EMOJIS = ["👍", "❤️", "😊", "😂", "🔥", "👏", "🎉", "💪", "✅", "❌", "⭐", "💡", "📌", "🚀", "💬", "👀"];
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const ChatPage = () => {
  const { user } = useAuth();
  const { chatId } = useParams();
  const navigate = useNavigate();
  
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showEditChatModal, setShowEditChatModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [chatType, setChatType] = useState("direct");
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null); // message_id
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("chatSoundEnabled");
    return saved === null ? true : saved === "true";
  });
  
  const messagesEndRef = useRef(null);
  const wsRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const currentChatRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);

  // Keep refs in sync
  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);
  
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Save sound preference
  useEffect(() => {
    localStorage.setItem("chatSoundEnabled", soundEnabled);
  }, [soundEnabled]);

  // Fetch chats list
  const fetchChats = useCallback(async () => {
    try {
      const res = await api.get("/chats");
      setChats(res.data.chats || []);
    } catch (error) {
      console.log("Failed to fetch chats");
    }
  }, []);

  // Fetch messages
  const fetchMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/chats/${id}/messages?limit=100`);
      setMessages(res.data.messages || []);
      scrollToBottom();
    } catch (error) {
      console.log("Failed to fetch messages");
    }
  }, []);

  // Fetch current chat info
  const fetchCurrentChat = useCallback(async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/chats/${id}`);
      setCurrentChat(res.data);
    } catch (error) {
      toast.error("Чат не найден");
      navigate("/chat");
    }
  }, [navigate]);

  // Connect WebSocket
  const connectWebSocket = useCallback((id) => {
    if (!id) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const apiUrl = new URL(API);
    const wsUrl = `${wsProtocol}//${apiUrl.host}/api/ws/chat/${id}?token=${token}`;

    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "new_message") {
            setMessages(prev => [...prev, data.message]);
            scrollToBottom();
            // Play sound based on chat type and settings
            // Direct messages always play sound, group/general respect settings
            const isDirectMessage = currentChat?.type === "direct";
            if (isDirectMessage || soundEnabled) {
              playNotificationSound();
            }
          } else if (data.type === "reaction_update") {
            setMessages(prev => prev.map(m => 
              m.id === data.message_id ? { ...m, reactions: data.reactions } : m
            ));
          } else if (data.type === "message_deleted") {
            setMessages(prev => prev.filter(m => m.id !== data.message_id));
          }
        } catch (e) {
          if (event.data === "ping") {
            wsRef.current?.send("pong");
          }
        }
      };

      wsRef.current.onclose = () => {
        setTimeout(() => {
          if (chatId === id) {
            connectWebSocket(id);
          }
        }, 3000);
      };
    } catch (error) {
      console.log("WebSocket error");
    }
  }, [chatId]);

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.value = 0.2;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {}
  };

  // Initial load
  useEffect(() => {
    fetchChats();
    setLoading(false);
  }, [fetchChats]);

  // Load chat when ID changes
  useEffect(() => {
    if (chatId) {
      fetchCurrentChat(chatId);
      fetchMessages(chatId);
      connectWebSocket(chatId);
    } else {
      setCurrentChat(null);
      setMessages([]);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [chatId, fetchCurrentChat, fetchMessages, connectWebSocket]);

  // Scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Send message
  const handleSendMessage = async (e, imageUrl = null) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !imageUrl) || !chatId || sending) return;

    setSending(true);
    try {
      const res = await api.post(`/chats/${chatId}/messages`, { 
        text: newMessage || (imageUrl ? "📷 Изображение" : ""),
        image_url: imageUrl
      });
      setMessages(prev => [...prev, res.data]);
      setNewMessage("");
      scrollToBottom();
      inputRef.current?.focus();
      fetchChats(); // Update last message in chat list
    } catch (error) {
      toast.error("Ошибка отправки");
    } finally {
      setSending(false);
    }
  };

  // Add emoji
  const addEmoji = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Add reaction
  const addReaction = async (messageId, emoji) => {
    try {
      await api.post(`/chats/${chatId}/messages/${messageId}/reactions`, { emoji });
      setShowReactionPicker(null);
    } catch (error) {
      toast.error("Ошибка");
    }
  };

  // Upload image
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Выберите изображение");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 5MB)");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/chat/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      await handleSendMessage(null, res.data.url);
    } catch (error) {
      toast.error("Ошибка загрузки");
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Create new chat
  const handleCreateChat = async () => {
    if (chatType === "direct" && selectedUserIds.length !== 1) {
      toast.error("Выберите одного пользователя для личного чата");
      return;
    }
    if (chatType === "group" && !groupName.trim()) {
      toast.error("Введите название группы");
      return;
    }
    if (chatType === "group" && selectedUserIds.length === 0) {
      toast.error("Добавьте хотя бы одного участника");
      return;
    }

    try {
      const payload = {
        type: chatType,
        participant_ids: selectedUserIds,
        name: chatType === "group" ? groupName : null
      };
      const res = await api.post("/chats", payload);
      setShowNewChatModal(false);
      setSelectedUserIds([]);
      setGroupName("");
      setChatType("direct");
      fetchChats();
      navigate(`/chat/${res.data.id}`);
    } catch (error) {
      toast.error("Ошибка создания чата");
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Update chat participants
  const handleUpdateParticipants = async () => {
    if (!currentChat || currentChat.type === "general") return;
    
    try {
      await api.put(`/chats/${currentChat.id}/participants`, {
        participant_ids: selectedUserIds
      });
      toast.success("Участники обновлены");
      setShowEditChatModal(false);
      fetchCurrentChat(currentChat.id);
      fetchChats();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Ошибка обновления");
    }
  };

  // Open edit chat modal
  const openEditChatModal = () => {
    if (!currentChat) return;
    setSelectedUserIds(currentChat.participant_ids || []);
    setGroupName(currentChat.name || "");
    fetchAvailableUsers();
    setShowEditChatModal(true);
  };

  // Open general chat
  const openGeneralChat = async () => {
    try {
      const res = await api.get("/chats/general");
      navigate(`/chat/${res.data.id}`);
    } catch (error) {
      toast.error("Ошибка");
    }
  };

  // Fetch users for new chat
  const fetchAvailableUsers = async () => {
    try {
      const res = await api.get("/users/available-for-chat");
      setAvailableUsers(res.data.users || []);
    } catch (error) {
      console.log("Failed to fetch users");
    }
  };

  // Format time
  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  // Get chat icon
  const getChatIcon = (chat) => {
    switch (chat?.type) {
      case "general": return <Hash size={18} className="text-[#FF9900]" />;
      case "direct": return <User size={18} className="text-blue-400" />;
      case "group": return <Users size={18} className="text-green-400" />;
      case "brand": return <MessageSquare size={18} className="text-purple-400" />;
      default: return <MessageSquare size={18} />;
    }
  };

  // Filter chats
  const filteredChats = chats.filter(c => 
    !searchQuery || c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="text-[#FF9900] font-mono">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] bg-[#0F1115] rounded-lg overflow-hidden border border-[#2A2F3A]">
      {/* Sidebar - Chat List */}
      <div className="w-80 border-r border-[#2A2F3A] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#2A2F3A]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-[#E6E6E6] flex items-center gap-2">
              <MessageSquare className="text-[#FF9900]" size={20} />
              Чаты
            </h2>
            <Button 
              size="sm" 
              onClick={() => { setShowNewChatModal(true); fetchAvailableUsers(); }}
              className="bg-[#FF9900] hover:bg-[#E68A00] text-black h-8 w-8 p-0"
            >
              <Plus size={16} />
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск..."
              className="pl-9 h-9 bg-[#13161B] border-[#2A2F3A] text-sm"
            />
          </div>
        </div>

        {/* General Chat Button */}
        <div className="p-2 border-b border-[#2A2F3A]">
          <button
            onClick={openGeneralChat}
            className="w-full flex items-center gap-3 p-3 rounded hover:bg-[#1A1D24] transition-colors text-left"
          >
            <Hash size={20} className="text-[#FF9900]" />
            <span className="text-[#E6E6E6] font-medium">Общий чат</span>
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.filter(c => c.type !== "general").length === 0 ? (
            <div className="p-4 text-center text-[#94A3B8] text-sm">
              Нет личных чатов
            </div>
          ) : (
            filteredChats.filter(c => c.type !== "general").map(chat => (
              <button
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className={`w-full flex items-center gap-3 p-3 border-b border-[#2A2F3A]/50 hover:bg-[#1A1D24] transition-colors text-left ${
                  chatId === chat.id ? "bg-[#FF9900]/10" : ""
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#2A2F3A] flex items-center justify-center flex-shrink-0">
                  {getChatIcon(chat)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium truncate ${chatId === chat.id ? "text-[#FF9900]" : "text-[#E6E6E6]"}`}>
                      {chat.name || "Чат"}
                    </span>
                    {chat.unread_count > 0 && (
                      <span className="min-w-[20px] h-5 flex items-center justify-center text-xs font-bold bg-[#FF9900] text-black rounded-full px-1">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                  {chat.last_message && (
                    <p className="text-xs text-[#94A3B8] truncate mt-0.5">
                      {chat.last_message.sender_nickname}: {chat.last_message.text}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-[#2A2F3A] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#2A2F3A] flex items-center justify-center">
                  {getChatIcon(currentChat)}
                </div>
                <div>
                  <h3 className="font-bold text-[#E6E6E6]">{currentChat.name || "Чат"}</h3>
                  <p className="text-xs text-[#94A3B8]">
                    {currentChat.type === "general" ? "Все участники" : 
                     (currentChat.participants?.length || 0) + " участник(ов)"}
                  </p>
                </div>
              </div>
              {/* Chat action buttons */}
              <div className="flex items-center gap-2">
                {/* Sound toggle - only for non-direct chats */}
                {currentChat.type !== "direct" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`${soundEnabled ? "text-green-400" : "text-[#94A3B8]"} hover:bg-[#2A2F3A]`}
                    title={soundEnabled ? "Звук включён" : "Звук выключен"}
                  >
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </Button>
                )}
                {/* Edit participants button - for creator or super_admin, non-general chats */}
                {currentChat.type !== "general" && (currentChat.created_by === user?.id || user?.role === "super_admin") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={openEditChatModal}
                    className="text-[#94A3B8] hover:text-[#FF9900] hover:bg-[#FF9900]/10"
                  >
                    <Settings size={18} />
                  </Button>
                )}
                {/* Delete chat button - only for super_admin and non-general chats */}
                {user?.role === "super_admin" && currentChat.type !== "general" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!window.confirm("Удалить этот чат и все сообщения?")) return;
                      try {
                        await api.delete(`/chats/${currentChat.id}`);
                        toast.success("Чат удалён");
                        fetchChats();
                        navigate("/chat");
                      } catch (error) {
                        toast.error(error.response?.data?.detail || "Ошибка удаления");
                      }
                    }}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 size={18} />
                  </Button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[#94A3B8]">
                  <div className="text-center">
                    <MessageSquare size={48} className="mx-auto mb-2 opacity-50" />
                    <p>Начните диалог</p>
                  </div>
                </div>
              ) : (
                messages.map((msg) => {
                  const isOwn = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} group`}>
                      <div className={`max-w-[70%] ${isOwn ? "order-1" : ""}`}>
                        {!isOwn && (
                          <span className="text-xs text-[#94A3B8] mb-1 block">
                            {msg.sender_nickname}
                            <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                              msg.sender_role === "super_admin" ? "bg-purple-500/20 text-purple-400" :
                              msg.sender_role === "admin" ? "bg-blue-500/20 text-blue-400" :
                              "bg-green-500/20 text-green-400"
                            }`}>
                              {msg.sender_role === "super_admin" ? "СА" : msg.sender_role === "admin" ? "А" : "С"}
                            </span>
                          </span>
                        )}
                        <div className={`relative rounded-lg px-4 py-2 ${
                          isOwn 
                            ? "bg-[#FF9900] text-black" 
                            : "bg-[#2A2F3A] text-[#E6E6E6]"
                        }`}>
                          {msg.image_url && (() => {
                            // Build correct image URL - handle both old (/api/...) and new (/chat/...) formats
                            let imgUrl = msg.image_url;
                            if (imgUrl.startsWith("/api/")) {
                              // Old format: /api/chat/images/xxx -> use BACKEND_URL directly
                              imgUrl = `${API.replace('/api', '')}${imgUrl}`;
                            } else if (imgUrl.startsWith("/")) {
                              // New format: /chat/images/xxx -> add API prefix
                              imgUrl = `${API}${imgUrl}`;
                            }
                            return (
                              <img 
                                src={imgUrl} 
                                alt="Изображение" 
                                className="max-w-full rounded mb-2 max-h-64 object-contain cursor-pointer"
                                onClick={() => window.open(imgUrl, "_blank")}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            );
                          })()}
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                          
                          {/* Action buttons (on hover) */}
                          <div className={`absolute -bottom-2 ${isOwn ? "left-0" : "right-0"} opacity-0 group-hover:opacity-100 transition-opacity flex gap-1`}>
                            {/* Reaction button */}
                            <button
                              onClick={() => setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id)}
                              className="bg-[#2A2F3A] hover:bg-[#3A3F4A] rounded-full p-1 text-xs"
                            >
                              😊
                            </button>
                            {/* Delete button - only for own messages or super_admin */}
                            {(msg.sender_id === user?.id || user?.role === "super_admin") && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm("Удалить сообщение?")) return;
                                  try {
                                    await api.delete(`/chats/${currentChat.id}/messages/${msg.id}`);
                                    setMessages(prev => prev.filter(m => m.id !== msg.id));
                                    toast.success("Сообщение удалено");
                                  } catch (error) {
                                    toast.error("Ошибка удаления");
                                  }
                                }}
                                className="bg-[#2A2F3A] hover:bg-red-500/30 text-red-400 rounded-full p-1 text-xs"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                          
                          {/* Reaction picker */}
                          {showReactionPicker === msg.id && (
                            <div className={`absolute -bottom-10 ${isOwn ? "left-0" : "right-0"} bg-[#13161B] border border-[#2A2F3A] rounded-lg p-1 flex gap-1 z-10`}>
                              {REACTION_EMOJIS.map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={() => addReaction(msg.id, emoji)}
                                  className="w-7 h-7 hover:bg-[#2A2F3A] rounded text-sm"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Display reactions */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={`flex gap-1 mt-1 flex-wrap ${isOwn ? "justify-end" : ""}`}>
                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => addReaction(msg.id, emoji)}
                                className={`text-xs px-1.5 py-0.5 rounded-full border ${
                                  users.includes(user?.id) 
                                    ? "bg-[#FF9900]/20 border-[#FF9900]" 
                                    : "bg-[#2A2F3A] border-[#2A2F3A]"
                                }`}
                              >
                                {emoji} {users.length}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        <span className={`text-[10px] text-[#94A3B8] mt-1 block ${isOwn ? "text-right" : ""}`}>
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-[#2A2F3A]">
              <div className="flex items-center gap-2">
                {/* Emoji Button */}
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-[#94A3B8] hover:text-[#FF9900] h-10 w-10 p-0"
                  >
                    <Smile size={20} />
                  </Button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-12 left-0 bg-[#13161B] border border-[#2A2F3A] rounded-lg p-3 z-50 shadow-xl">
                      <div className="grid grid-cols-8 gap-2 min-w-[280px]">
                        {EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => addEmoji(emoji)}
                            className="w-8 h-8 hover:bg-[#2A2F3A] rounded text-xl flex items-center justify-center transition-colors"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Image Upload Button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="text-[#94A3B8] hover:text-[#FF9900] h-10 w-10 p-0"
                >
                  {uploadingImage ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                </Button>

                {/* Text Input */}
                <Input
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  className="flex-1 bg-[#13161B] border-[#2A2F3A]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />

                {/* Send Button */}
                <Button
                  type="submit"
                  disabled={!newMessage.trim() || sending}
                  className="bg-[#FF9900] hover:bg-[#E68A00] text-black h-10 w-10 p-0"
                >
                  <Send size={18} />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#94A3B8]">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium text-[#E6E6E6] mb-2">Выберите чат</h3>
              <p className="text-sm">или создайте новый</p>
              <Button 
                onClick={() => { setShowNewChatModal(true); fetchAvailableUsers(); }}
                className="mt-4 bg-[#FF9900] hover:bg-[#E68A00] text-black"
              >
                <Plus size={16} className="mr-2" /> Новый чат
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader>
            <DialogTitle className="text-[#FF9900] flex items-center gap-2">
              <Plus size={18} /> Новый чат
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[#94A3B8] text-sm">Тип чата</label>
              <Select value={chatType} onValueChange={(v) => { setChatType(v); setSelectedUserIds([]); }}>
                <SelectTrigger className="bg-[#0F1115] border-[#2A2F3A]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#13161B] border-[#2A2F3A]">
                  <SelectItem value="direct">
                    <span className="flex items-center gap-2">
                      <User size={14} /> Личный чат
                    </span>
                  </SelectItem>
                  <SelectItem value="group">
                    <span className="flex items-center gap-2">
                      <Users size={14} /> Групповой чат
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {chatType === "group" && (
              <div className="space-y-2">
                <label className="text-[#94A3B8] text-sm">Название группы</label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Введите название..."
                  className="bg-[#0F1115] border-[#2A2F3A]"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[#94A3B8] text-sm">
                {chatType === "direct" ? "Пользователь" : `Участники (${selectedUserIds.length})`}
              </label>
              
              {/* Selected users badges */}
              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedUserIds.map(uid => {
                    const u = availableUsers.find(x => x.id === uid);
                    if (!u) return null;
                    return (
                      <span 
                        key={uid}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-[#FF9900]/20 text-[#FF9900] rounded text-sm"
                      >
                        {u.nickname || u.email}
                        <button 
                          onClick={() => toggleUserSelection(uid)}
                          className="hover:text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              
              {/* User list for selection */}
              <div className="max-h-48 overflow-y-auto border border-[#2A2F3A] rounded bg-[#0F1115]">
                {availableUsers.filter(u => !selectedUserIds.includes(u.id)).map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (chatType === "direct") {
                        setSelectedUserIds([u.id]);
                      } else {
                        toggleUserSelection(u.id);
                      }
                    }}
                    className="w-full flex items-center gap-2 p-2 hover:bg-[#2A2F3A] text-left text-sm"
                  >
                    <User size={14} className="text-[#94A3B8]" />
                    <span className="text-[#E6E6E6]">{u.nickname || u.email}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ml-auto ${
                      u.role === "super_admin" ? "bg-purple-500/20 text-purple-400" :
                      u.role === "admin" ? "bg-blue-500/20 text-blue-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>
                      {u.role === "super_admin" ? "СА" : u.role === "admin" ? "Админ" : "Сёрчер"}
                    </span>
                  </button>
                ))}
                {availableUsers.filter(u => !selectedUserIds.includes(u.id)).length === 0 && (
                  <div className="p-3 text-center text-[#94A3B8] text-sm">
                    Все пользователи добавлены
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowNewChatModal(false); setSelectedUserIds([]); }} className="border-[#2A2F3A]">
                Отмена
              </Button>
              <Button onClick={handleCreateChat} className="bg-[#FF9900] hover:bg-[#E68A00] text-black">
                Создать
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Chat Modal */}
      <Dialog open={showEditChatModal} onOpenChange={setShowEditChatModal}>
        <DialogContent className="bg-[#13161B] border-[#2A2F3A] text-[#E6E6E6]">
          <DialogHeader>
            <DialogTitle className="text-[#FF9900] flex items-center gap-2">
              <Users size={18} /> Редактировать участников
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {currentChat?.type === "group" && (
              <div className="space-y-2">
                <label className="text-[#94A3B8] text-sm">Название группы</label>
                <Input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Введите название..."
                  className="bg-[#0F1115] border-[#2A2F3A]"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[#94A3B8] text-sm">
                Участники ({selectedUserIds.length})
              </label>
              
              {/* Selected users badges */}
              {selectedUserIds.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedUserIds.map(uid => {
                    const u = availableUsers.find(x => x.id === uid);
                    const isCreator = currentChat?.created_by === uid;
                    if (!u) return null;
                    return (
                      <span 
                        key={uid}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-sm ${
                          isCreator ? "bg-purple-500/20 text-purple-400" : "bg-[#FF9900]/20 text-[#FF9900]"
                        }`}
                      >
                        {u.nickname || u.email}
                        {isCreator && <span className="text-xs">(создатель)</span>}
                        {!isCreator && (
                          <button 
                            onClick={() => toggleUserSelection(uid)}
                            className="hover:text-red-400"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              
              {/* User list for selection */}
              <div className="max-h-48 overflow-y-auto border border-[#2A2F3A] rounded bg-[#0F1115]">
                {availableUsers.filter(u => !selectedUserIds.includes(u.id)).map(u => (
                  <button
                    key={u.id}
                    onClick={() => toggleUserSelection(u.id)}
                    className="w-full flex items-center gap-2 p-2 hover:bg-[#2A2F3A] text-left text-sm"
                  >
                    <Plus size={14} className="text-green-400" />
                    <span className="text-[#E6E6E6]">{u.nickname || u.email}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ml-auto ${
                      u.role === "super_admin" ? "bg-purple-500/20 text-purple-400" :
                      u.role === "admin" ? "bg-blue-500/20 text-blue-400" :
                      "bg-green-500/20 text-green-400"
                    }`}>
                      {u.role === "super_admin" ? "СА" : u.role === "admin" ? "Админ" : "Сёрчер"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowEditChatModal(false)} className="border-[#2A2F3A]">
                Отмена
              </Button>
              <Button onClick={handleUpdateParticipants} className="bg-[#FF9900] hover:bg-[#E68A00] text-black">
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatPage;
