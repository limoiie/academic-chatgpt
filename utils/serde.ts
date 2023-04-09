import {
  AIChatMessage,
  BaseChatMessage,
  ChatMessage,
  HumanChatMessage,
  MessageType,
  SystemChatMessage,
} from 'langchain/schema';

export function openaiChatMessageToObject(message: BaseChatMessage) {
  return {
    type: message._getType(),
    text: message.text,
    role: message instanceof ChatMessage ? message.role : undefined,
  };
}

export function objectToOpenaiChatMessage(object: any) {
  switch (object.type as MessageType) {
    case 'human':
      return new HumanChatMessage(object.text);
    case 'ai':
      return new AIChatMessage(object.text);
    case 'system':
      return new SystemChatMessage(object.text);
    case 'generic':
      return new ChatMessage(object.text, object.role);
  }
}
