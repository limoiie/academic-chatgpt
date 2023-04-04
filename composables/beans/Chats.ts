import {
  AIChatMessage,
  BaseChatMessage,
  ChainValues,
  ChatGeneration,
  HumanChatMessage,
  LLMResult,
  SystemChatMessage,
} from 'langchain/schema';
import { stringify } from 'yaml';

export interface UiChatMessage {
  message: BaseChatMessage;
  username: string;
}

export class UiChatDialogue {
  question: UiChatMessage;
  answering: UiChatMessage;
  answers: UiChatMessage[];
  chosen: number;
  error: any | undefined = undefined;

  constructor(question: UiChatMessage, answers: UiChatMessage[] = [], chosen: number = -1) {
    this.question = question;
    this.answering = {
      username: 'GhatGPT',
      message: new AIChatMessage(''),
    };
    this.answers = answers;
    this.chosen = chosen;
  }

  get chosen_answer() {
    if (this.chosen == -1) {
      return this.answering;
    }
    return this.answers[this.chosen];
  }

  async answer(llmResult: LLMResult) {
    this.chosen = 0;
    this.answers = await Promise.all(
      (llmResult.generations[0] as ChatGeneration[])
        .flatMap((choice) => (choice.message ? [choice.message] : []))
        .map(async (message) => {
          return {
            message: message,
            username: 'ChatGPT',
          };
        }),
    );
  }

  async answerChainValues(result: ChainValues) {
    this.chosen = 0;
    this.answers = [
      {
        message: new AIChatMessage(stringify(result)),
        username: 'ChatGPT',
      },
    ];
  }

  async failedToAnswer(error: unknown) {
    this.error = error;
  }
}

export class UiChatConversation {
  prompt: SystemChatMessage;
  dialogues: UiChatDialogue[];

  constructor(prompt: SystemChatMessage, dialogues: UiChatDialogue[] = []) {
    this.prompt = prompt;
    this.dialogues = dialogues;
  }

  extractMessages() {
    return [
      this.prompt,
      ...this.dialogues.flatMap((dialogue) => {
        if (!dialogue.answers || !dialogue.answers[dialogue.chosen]) {
          return [dialogue.question.message];
        }
        return [dialogue.question.message, dialogue.answers[dialogue.chosen].message];
      }),
    ];
  }

  extractHistory(): [string, string][] {
    return this.dialogues.slice(0, -1).map((dialogue) => {
      return [dialogue.question.message.text, dialogue.chosen_answer.message.text];
    });
  }

  async question(text: string) {
    const question = new HumanChatMessage(text);
    const i = this.dialogues.push(
      new UiChatDialogue({
        username: 'LM',
        message: question,
      }),
    );
    return this.dialogues[i - 1];
  }
}
