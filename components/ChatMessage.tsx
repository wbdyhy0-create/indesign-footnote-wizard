import React from 'react';
// וודא שהייבוא יוצא רמה אחת למעלה ל-types
import { ChatMessage, MessageRole } from '../types';

interface ChatMessageProps {
  message: ChatMessage;
}

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message }) => {
  // הגדרת המשתנים בצורה בטוחה כדי למנוע שגיאות BinaryExpression
  const isUser = message.role === MessageRole.USER;
  const isInfo = message.role === MessageRole.INFO;

  if (isInfo) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-slate-800/50 text-slate-400 text-[10px] px-3 py-1 rounded-full border border-slate-700/50">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-4 w-full`}>
      <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-lg ${
        isUser 
          ? 'bg-amber-600 text-white rounded-tr-none shadow-amber-600/20' 
          : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
      }`}>
        <div className="leading-relaxed whitespace-pre-wrap">{message.text}</div>
        <div className={`text-[10px] mt-1 opacity-50 ${isUser ? 'text-left' : 'text-right'}`}>
          {/* שימוש בבדיקה בטוחה לתאריך */}
          {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </div>
      </div>
    </div>
  );
};

export default ChatMessageComponent;