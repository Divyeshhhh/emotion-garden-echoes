
import OpenAI from 'openai';

// This will be replaced with proper API key management via Supabase secrets
const getOpenAIClient = (apiKey: string) => {
  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true // Only for demo purposes
  });
};

export const analyzeSentiment = async (text: string, apiKey: string): Promise<string> => {
  try {
    const openai = getOpenAIClient(apiKey);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Analyze the emotional sentiment of the given text and respond with only one of these emotions: joy, sadness, anger, fear, love, surprise, peace, nostalgia. Choose the most dominant emotion.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    });

    const emotion = response.choices[0]?.message?.content?.toLowerCase().trim();
    const validEmotions = ['joy', 'sadness', 'anger', 'fear', 'love', 'surprise', 'peace', 'nostalgia'];
    
    return validEmotions.includes(emotion || '') ? emotion! : 'peace';
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
    return 'peace'; // Default fallback
  }
};

export const autoCompleteText = async (partialText: string, apiKey: string): Promise<string> => {
  try {
    const openai = getOpenAIClient(apiKey);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Complete the following journal entry in a natural, personal way. Keep it authentic and meaningful. Only provide the completion, not the original text.'
        },
        {
          role: 'user',
          content: partialText
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Auto-completion failed:', error);
    return '';
  }
};

export const findRelatedMemories = async (memories: any[], currentMemory: any, apiKey: string): Promise<string[]> => {
  try {
    const openai = getOpenAIClient(apiKey);
    
    const memoryTexts = memories.map(m => `${m.id}: ${m.title} - ${m.description}`).join('\n');
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Given a current memory and a list of other memories, identify which memories are thematically related. Return only the IDs of related memories as a comma-separated list.'
        },
        {
          role: 'user',
          content: `Current memory: ${currentMemory.title} - ${currentMemory.description}\n\nOther memories:\n${memoryTexts}`
        }
      ],
      temperature: 0.3,
      max_tokens: 100
    });

    const relatedIds = response.choices[0]?.message?.content?.split(',').map(id => id.trim()) || [];
    return relatedIds.filter(id => id && id !== currentMemory.id);
  } catch (error) {
    console.error('Finding related memories failed:', error);
    return [];
  }
};
