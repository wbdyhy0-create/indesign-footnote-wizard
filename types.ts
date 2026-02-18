
export interface ScriptFeature {
  title: string;
  description: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  scriptName: string;
  timestamp: string;
}

export interface ScriptData {
  id: string;
  name: string;
  shortDesc: string;
  fullDesc: string;
  features: ScriptFeature[];
  steps: string[];
  videoUrl: string;
  price: string;
  originalPrice?: string;
  color: string;
  downloadUrl?: string;
  trialDownloadUrl?: string;
  faqs?: FAQItem[];
  isDownloadable?: boolean; // New field for controlling full download availability
  isTrialDownloadable?: boolean; // New field for controlling trial download availability
}

export interface PurchaseDetails {
  name: string;
  email: string;
  phone: string;
  scriptId: string;
}