import { GoogleGenAI } from "@google/genai";
import { GameStats } from "../types";

const ORACLE_SYSTEM_INSTRUCTION = `
You are the Ancient Unicorn Oracle of the Ring World.
You speak in a mystical, slightly sarcastic, yet encouraging tone.
You are observing a unicorn running around a small circular world fighting shadows.
Keep responses short (under 2 sentences).
If the player died, write a short eulogy.
If the player is asking for a tip, give a cryptic gameplay hint based on their stats.
`;

export const consultOracle = async (stats: GameStats, eventType: 'DEATH' | 'TIP'): Promise<string> => {
  try {
    // Defensive check for API key existence
    if (!process.env.API_KEY) {
      return "The Oracle is silent (Missing API_KEY).";
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = eventType === 'DEATH' 
      ? `The unicorn has fallen. Stats: Survived ${stats.timeSurvived}s, Killed ${stats.enemiesKilled} shadows, Collected ${stats.shards} shards. Write a eulogy.`
      : `The unicorn seeks wisdom. Current Stats: Survived ${stats.timeSurvived}s, Berries: ${stats.berries}. Give a gameplay tip about farming or fighting.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: ORACLE_SYSTEM_INSTRUCTION,
        maxOutputTokens: 100,
      }
    });

    return response.text || "The stars are cloudy today...";
  } catch (error) {
    console.error("Oracle connection failed:", error);
    return "The void interferes with my vision (API Error).";
  }
};