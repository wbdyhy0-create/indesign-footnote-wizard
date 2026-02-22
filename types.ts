export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  INFO = 'info'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
}

export interface ScriptData {
  id: string;
  name: string;
  shortDesc: string;
  fullDesc: string;
  features: { title: string; description: string }[];
  steps: string[];
  faqs: { question: string; answer: string }[];
  videoUrl?: string;
  price: string;
  originalPrice?: string;
  color: string;
  downloadUrl?: string;
  trialDownloadUrl?: string;
  isDownloadable?: boolean;
  isTrialDownloadable?: boolean;
}

export interface FAQItem {
  question: string;
  answer: string;
}